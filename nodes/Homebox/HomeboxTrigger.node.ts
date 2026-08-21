import type {
	IDataObject,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	IPollFunctions,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import {
	getLocationPathOptions,
	getLocationSubtreeIds,
	getTagOptions,
	homeboxApiRequest,
	parseCsv,
} from './GenericFunctions';
import type { HomeboxEntityListResult, HomeboxEntitySummary, HomeboxMaintenanceEntry } from './types';

const PAGE_SIZE = 50;
const MAX_PAGES_PER_POLL = 10;

export class HomeboxTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Homebox Trigger',
		name: 'homeboxTrigger',
		icon: { light: 'file:homebox.svg', dark: 'file:homebox.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["event"]}}',
		description:
			'Starts a workflow on Homebox inventory events. Homebox has no webhooks, so this node polls the API on a schedule.',
		defaults: {
			name: 'Homebox Trigger',
		},
		polling: true,
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'homeboxApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				options: [
					{
						name: 'Item Updated',
						value: 'itemUpdated',
						description: 'Triggers when an existing item is modified',
					},
					{
						name: 'Maintenance Due',
						value: 'maintenanceDue',
						description:
							'Triggers when a scheduled maintenance entry comes due within the window (overdue entries included)',
					},
					{
						name: 'New Item',
						value: 'newItem',
						description: 'Triggers when an item is added to the inventory',
					},
					{
						name: 'New Item in Location',
						value: 'newItemInLocation',
						description: 'Triggers when an item is added to a selected location',
					},
					{
						name: 'Warranty Expiring',
						value: 'warrantyExpiring',
						description: 'Triggers when the warranty of an item expires within the window',
					},
				],
				default: 'newItem',
			},
			{
				// eslint-disable-next-line n8n-nodes-base/node-param-display-name-wrong-for-dynamic-multi-options
				displayName: 'Locations',
				name: 'locationIds',
				type: 'multiOptions',
				typeOptions: {
					loadOptionsMethod: 'getLocations',
				},
				default: [],
				required: true,
				description:
					'Locations to watch. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				displayOptions: {
					show: {
						event: ['newItemInLocation'],
					},
				},
			},
			{
				displayName: 'Include Sub-Locations',
				name: 'includeSubtree',
				type: 'boolean',
				default: true,
				description: 'Whether items added anywhere below the selected locations also trigger',
				displayOptions: {
					show: {
						event: ['newItemInLocation'],
					},
				},
			},
			{
				displayName: 'Window (Days)',
				name: 'windowDays',
				type: 'number',
				typeOptions: {
					minValue: 1,
				},
				default: 30,
				description: 'Trigger for warranties expiring within this many days from now',
				displayOptions: {
					show: {
						event: ['warrantyExpiring'],
					},
				},
			},
			{
				displayName: 'Window (Days)',
				name: 'windowDays',
				type: 'number',
				typeOptions: {
					minValue: 1,
				},
				default: 7,
				description: 'Trigger for maintenance scheduled within this many days from now',
				displayOptions: {
					show: {
						event: ['maintenanceDue'],
					},
				},
			},
		],
	};

	methods = {
		loadOptions: {
			async getLocations(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return await getLocationPathOptions.call(this);
			},
			async getTags(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return await getTagOptions.call(this);
			},
		},
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const event = this.getNodeParameter('event') as string;
		const isManual = this.getMode() === 'manual';

		if (event === 'newItem' || event === 'newItemInLocation' || event === 'itemUpdated') {
			return await pollItemList.call(this, event, isManual);
		}
		if (event === 'warrantyExpiring') {
			return await pollWarranty.call(this, isManual);
		}
		return await pollMaintenance.call(this, isManual);
	}
}

/**
 * Watermark polling over the entity list, sorted newest-first by the server
 * (orderBy=createdAt/updatedAt). On the first poll nothing is emitted — the
 * watermark is recorded so only later changes trigger.
 */
async function pollItemList(
	this: IPollFunctions,
	event: string,
	isManual: boolean,
): Promise<INodeExecutionData[][] | null> {
	const staticData = this.getWorkflowStaticData('node');
	const byUpdated = event === 'itemUpdated';
	const watermarkKey = byUpdated ? 'lastUpdatedAt' : 'lastCreatedAt';
	const timestampOf = (item: HomeboxEntitySummary) =>
		byUpdated ? item.updatedAt : item.createdAt;

	const qs: IDataObject = {
		orderBy: byUpdated ? 'updatedAt' : 'createdAt',
		pageSize: PAGE_SIZE,
	};
	if (event === 'newItemInLocation') {
		const locationIds = this.getNodeParameter('locationIds') as string[];
		const includeSubtree = this.getNodeParameter('includeSubtree') as boolean;
		qs.parentIds = includeSubtree
			? await getLocationSubtreeIds.call(this, locationIds)
			: locationIds;
	}

	if (isManual) {
		const result = (await homeboxApiRequest.call(this, 'GET', '/entities', undefined, {
			...qs,
			page: 1,
			pageSize: 1,
		})) as HomeboxEntityListResult;
		const sample = result.items ?? [];
		return sample.length ? [this.helpers.returnJsonArray(sample as IDataObject[])] : null;
	}

	const watermark = staticData[watermarkKey] as string | undefined;

	// Keep the poll cheap: newest-first pages, stop at the first item at or
	// below the watermark.
	const fresh: HomeboxEntitySummary[] = [];
	let newestSeen = watermark;
	for (let page = 1; page <= MAX_PAGES_PER_POLL; page++) {
		const result = (await homeboxApiRequest.call(this, 'GET', '/entities', undefined, {
			...qs,
			page,
		})) as HomeboxEntityListResult;
		const items = result.items ?? [];
		if (items.length === 0) break;

		if (!newestSeen || Date.parse(timestampOf(items[0])) > Date.parse(newestSeen)) {
			if (page === 1) newestSeen = timestampOf(items[0]);
		}

		if (watermark === undefined) break; // first poll: just record the watermark

		let reachedWatermark = false;
		for (const item of items) {
			if (Date.parse(timestampOf(item)) <= Date.parse(watermark)) {
				reachedWatermark = true;
				break;
			}
			// For itemUpdated, skip items that are brand new (creation also
			// bumps updatedAt) — those belong to the New Item event.
			if (byUpdated && Date.parse(item.createdAt) > Date.parse(watermark)) continue;
			fresh.push(item);
		}
		if (reachedWatermark || items.length < PAGE_SIZE) break;
	}

	staticData[watermarkKey] = newestSeen ?? new Date().toISOString();

	if (watermark === undefined || fresh.length === 0) return null;
	fresh.reverse(); // emit oldest first
	return [this.helpers.returnJsonArray(fresh as unknown as IDataObject[])];
}

/**
 * Warranty data is not part of list summaries, so this event reads the CSV
 * export (a single request) and maps rows back to item IDs via the HB.url
 * column. Each item/expiry pair is emitted once.
 */
async function pollWarranty(
	this: IPollFunctions,
	isManual: boolean,
): Promise<INodeExecutionData[][] | null> {
	const staticData = this.getWorkflowStaticData('node');
	const windowDays = this.getNodeParameter('windowDays') as number;
	const emitted = (staticData.warrantyEmitted as IDataObject) ?? {};

	const csv = (await homeboxApiRequest.call(this, 'GET', '/entities/export', undefined, {}, {
		text: true,
	})) as string;
	const rows = parseCsv(csv);
	if (rows.length < 2) return null;

	const header = rows[0];
	const col = (name: string) => header.indexOf(name);
	const cName = col('HB.name');
	const cUrl = col('HB.url');
	const cExpires = col('HB.warranty_expires');
	const cLifetime = col('HB.lifetime_warranty');
	const cLocation = col('HB.location');
	const cAssetId = col('HB.asset_id');
	const cArchived = col('HB.archived');

	const now = Date.now();
	const windowEnd = now + windowDays * 24 * 60 * 60 * 1000;
	const results: IDataObject[] = [];
	const freshEmitted: IDataObject = {};

	for (const row of rows.slice(1)) {
		const expires = row[cExpires] ?? '';
		if (!expires || expires.startsWith('0001-')) continue;
		if (cLifetime >= 0 && row[cLifetime] === 'true') continue;
		if (cArchived >= 0 && row[cArchived] === 'true') continue;

		const expiryTime = Date.parse(expires);
		if (Number.isNaN(expiryTime) || expiryTime > windowEnd) continue;

		const id = (row[cUrl] ?? '').split('/item/')[1] ?? '';
		const key = `${id}|${expires}`;
		if (expiryTime >= now) freshEmitted[key] = true;
		if (!isManual && emitted[key]) continue;
		if (expiryTime < now && !isManual) continue; // already expired: only shown in manual runs

		results.push({
			id,
			name: row[cName] ?? '',
			assetId: cAssetId >= 0 ? row[cAssetId] : '',
			location: cLocation >= 0 ? row[cLocation] : '',
			warrantyExpires: expires,
			daysUntilExpiry: Math.ceil((expiryTime - now) / (24 * 60 * 60 * 1000)),
		});
	}

	// Keep only keys still inside the window so static data cannot grow forever.
	staticData.warrantyEmitted = { ...freshEmitted, ...(isManual ? emitted : {}) };

	return results.length ? [this.helpers.returnJsonArray(results)] : null;
}

/**
 * Scheduled maintenance entries coming due (or overdue). Each entry/date pair
 * is emitted once.
 */
async function pollMaintenance(
	this: IPollFunctions,
	isManual: boolean,
): Promise<INodeExecutionData[][] | null> {
	const staticData = this.getWorkflowStaticData('node');
	const windowDays = this.getNodeParameter('windowDays') as number;
	const emitted = (staticData.maintenanceEmitted as IDataObject) ?? {};

	const entries = (await homeboxApiRequest.call(this, 'GET', '/maintenance', undefined, {
		status: 'scheduled',
	})) as HomeboxMaintenanceEntry[];

	const now = Date.now();
	const windowEnd = now + windowDays * 24 * 60 * 60 * 1000;
	const results: IDataObject[] = [];
	const freshEmitted: IDataObject = {};

	for (const entry of entries) {
		const scheduled = entry.scheduledDate ?? '';
		if (!scheduled || scheduled.startsWith('0001-')) continue;
		const scheduledTime = Date.parse(scheduled);
		if (Number.isNaN(scheduledTime) || scheduledTime > windowEnd) continue;

		const key = `${entry.id}|${scheduled}`;
		freshEmitted[key] = true;
		if (!isManual && emitted[key]) continue;

		results.push({
			...entry,
			daysUntilDue: Math.ceil((scheduledTime - now) / (24 * 60 * 60 * 1000)),
			overdue: scheduledTime < now,
		});
	}

	staticData.maintenanceEmitted = freshEmitted;

	return results.length ? [this.helpers.returnJsonArray(results)] : null;
}
