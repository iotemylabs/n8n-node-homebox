import type {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeListSearchResult,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import {
	attachmentFields,
	attachmentOperations,
	groupFields,
	groupOperations,
	itemFields,
	itemOperations,
	locationFields,
	locationOperations,
	maintenanceFields,
	maintenanceOperations,
	tagFields,
	tagOperations,
} from './descriptions';
import {
	getLocationPathOptions,
	getTagOptions,
	homeboxApiRequest,
} from './GenericFunctions';
import { router } from './operations';
import type { HomeboxEntityListResult, HomeboxEntityOut } from './types';

export class Homebox implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Homebox',
		name: 'homebox',
		icon: { light: 'file:homebox.svg', dark: 'file:homebox.dark.svg' },
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Manage your Homebox home inventory: items, locations, tags, attachments and maintenance',
		defaults: {
			name: 'Homebox',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'homeboxApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Attachment', value: 'attachment' },
					{ name: 'Group', value: 'group' },
					{ name: 'Item', value: 'item' },
					{ name: 'Location', value: 'location' },
					{ name: 'Maintenance', value: 'maintenance' },
					{ name: 'Tag', value: 'tag' },
				],
				default: 'item',
			},
			...itemOperations,
			...itemFields,
			...locationOperations,
			...locationFields,
			...tagOperations,
			...tagFields,
			...attachmentOperations,
			...attachmentFields,
			...maintenanceOperations,
			...maintenanceFields,
			...groupOperations,
			...groupFields,
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
			async getAttachments(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const locator = this.getCurrentNodeParameter('itemId') as
					| { mode: string; value: string }
					| undefined;
				let itemId = (locator?.value ?? '').toString().trim();
				if (!itemId) return [];
				if (locator?.mode === 'assetId') {
					const result = (await homeboxApiRequest.call(
						this,
						'GET',
						`/assets/${itemId.replace(/^#/, '')}`,
					)) as HomeboxEntityListResult;
					itemId = result.items?.[0]?.id ?? '';
					if (!itemId) return [];
				}
				const entity = (await homeboxApiRequest.call(
					this,
					'GET',
					`/entities/${itemId}`,
				)) as HomeboxEntityOut;
				return (entity.attachments ?? []).map((a) => ({
					name: `${a.title || a.id} (${a.type})`,
					value: a.id,
				}));
			},
		},
		listSearch: {
			async searchItems(
				this: ILoadOptionsFunctions,
				filter?: string,
			): Promise<INodeListSearchResult> {
				const result = (await homeboxApiRequest.call(this, 'GET', '/entities', undefined, {
					q: filter ?? '',
					pageSize: 50,
					page: 1,
				})) as HomeboxEntityListResult;
				return {
					results: (result.items ?? []).map((item) => ({
						name: item.assetId ? `${item.name} (${item.assetId})` : item.name,
						value: item.id,
					})),
				};
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		return await router.call(this);
	}
}
