import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import {
	buildEntityUpdatePayload,
	homeboxApiRequest,
	homeboxApiRequestAllItems,
	mergedEntityUpdate,
} from '../GenericFunctions';
import type { HomeboxEntityOut, HomeboxEntityUpdatePayload } from '../types';
import {
	mergeCustomFields,
	parseCustomFieldsParameter,
	resolveItemId,
	toExecutionData,
} from './helpers';

/**
 * Maps the UI field names (locationId, customFields) onto the API payload
 * names (parentId, fields) shared by create-extras and update.
 */
function uiFieldsToEntityChanges(fields: IDataObject): Partial<HomeboxEntityUpdatePayload> {
	const changes: Partial<HomeboxEntityUpdatePayload> = {};
	const passThrough = [
		'name',
		'description',
		'quantity',
		'insured',
		'archived',
		'manufacturer',
		'modelNumber',
		'serialNumber',
		'notes',
		'purchaseDate',
		'purchaseFrom',
		'purchasePrice',
		'lifetimeWarranty',
		'warrantyExpires',
		'warrantyDetails',
		'soldTo',
		'soldPrice',
		'soldDate',
		'soldNotes',
	] as const;
	for (const key of passThrough) {
		if (fields[key] !== undefined) {
			(changes as IDataObject)[key] = fields[key];
		}
	}
	if (fields.locationId !== undefined && fields.locationId !== '') {
		changes.parentId = fields.locationId as string;
	}
	if (fields.tagIds !== undefined) {
		changes.tagIds = fields.tagIds as string[];
	}
	return changes;
}

export async function get(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const id = await resolveItemId.call(this, i);
	const response = await homeboxApiRequest.call(this, 'GET', `/entities/${id}`);
	return toExecutionData.call(this, response as IDataObject, i);
}

export async function getAll(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const returnAll = this.getNodeParameter('returnAll', i) as boolean;
	const limit = returnAll ? 0 : (this.getNodeParameter('limit', i) as number);
	const includeArchived = this.getNodeParameter('includeArchived', i) as boolean;
	const filters = this.getNodeParameter('filters', i, {}) as IDataObject;

	const qs: IDataObject = {};
	if (includeArchived) qs.includeArchived = 'true';
	if (filters.search) qs.q = filters.search;
	if ((filters.tagIds as string[])?.length) qs.tags = filters.tagIds;
	if (filters.negateTags) qs.negateTags = 'true';
	if ((filters.locationIds as string[])?.length) qs.parentIds = filters.locationIds;
	if (filters.onlyWithPhoto) qs.onlyWithPhoto = 'true';
	if (filters.onlyWithoutPhoto) qs.onlyWithoutPhoto = 'true';
	if (filters.topLevelOnly) qs.filterChildren = 'true';
	if (filters.orderBy) qs.orderBy = filters.orderBy;
	const fieldFilters = ((filters.customFieldFilters as IDataObject)?.filter as IDataObject[]) ?? [];
	if (fieldFilters.length) {
		qs.fields = fieldFilters.map((f) => `${f.name as string}=${f.value as string}`);
	}

	const items = await homeboxApiRequestAllItems.call(this, qs, returnAll, limit);
	return toExecutionData.call(this, items as IDataObject[], i);
}

export async function create(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const name = this.getNodeParameter('name', i) as string;
	const additionalFields = this.getNodeParameter('additionalFields', i, {}) as IDataObject;

	const body: IDataObject = { name };
	if (additionalFields.description) body.description = additionalFields.description;
	if (additionalFields.locationId) body.parentId = additionalFields.locationId;
	if (additionalFields.quantity !== undefined) body.quantity = additionalFields.quantity;
	if ((additionalFields.tagIds as string[])?.length) body.tagIds = additionalFields.tagIds;

	let created = (await homeboxApiRequest.call(this, 'POST', '/entities', body)) as HomeboxEntityOut;

	// The create endpoint only accepts name/description/parent/quantity/tags.
	// Everything else the user set is applied with a merged follow-up update.
	const extras: IDataObject = { ...additionalFields };
	delete extras.description;
	delete extras.locationId;
	delete extras.quantity;
	delete extras.tagIds;
	const customFields = parseCustomFieldsParameter(extras.customFields as IDataObject);
	delete extras.customFields;

	if (Object.keys(extras).length > 0 || customFields.length > 0) {
		const changes = uiFieldsToEntityChanges(extras);
		if (customFields.length > 0) {
			changes.fields = customFields;
		}
		created = await mergedEntityUpdate.call(this, created.id, changes);
	}

	return toExecutionData.call(this, created as IDataObject, i);
}

export async function update(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const id = await resolveItemId.call(this, i);
	const updateFields = this.getNodeParameter('updateFields', i, {}) as IDataObject;

	const current = (await homeboxApiRequest.call(
		this,
		'GET',
		`/entities/${id}`,
	)) as HomeboxEntityOut;

	const changes = uiFieldsToEntityChanges(updateFields);
	const customFieldChanges = parseCustomFieldsParameter(updateFields.customFields as IDataObject);
	if (customFieldChanges.length > 0) {
		changes.fields = mergeCustomFields(current.fields ?? [], customFieldChanges);
	}

	const payload = buildEntityUpdatePayload(current, changes);
	const response = await homeboxApiRequest.call(
		this,
		'PUT',
		`/entities/${id}`,
		payload as unknown as IDataObject,
	);
	return toExecutionData.call(this, response as IDataObject, i);
}

export async function del(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const id = await resolveItemId.call(this, i);
	await homeboxApiRequest.call(this, 'DELETE', `/entities/${id}`);
	return toExecutionData.call(this, { success: true, id }, i);
}

export async function getPath(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const id = await resolveItemId.call(this, i);
	const path = (await homeboxApiRequest.call(
		this,
		'GET',
		`/entities/${id}/path`,
	)) as IDataObject[];
	return toExecutionData.call(
		this,
		{ path, pathString: path.map((p) => p.name as string).join(' → ') },
		i,
	);
}

export async function duplicate(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const id = await resolveItemId.call(this, i);
	const options = this.getNodeParameter('duplicateOptions', i, {}) as IDataObject;
	const body: IDataObject = {
		copyAttachments: options.copyAttachments ?? true,
		copyCustomFields: options.copyCustomFields ?? true,
		copyMaintenance: options.copyMaintenance ?? false,
		copyPrefix: options.copyPrefix ?? 'Copy of ',
	};
	const response = await homeboxApiRequest.call(this, 'POST', `/entities/${id}/duplicate`, body);
	return toExecutionData.call(this, response as IDataObject, i);
}

export async function archive(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const id = await resolveItemId.call(this, i);
	const response = await mergedEntityUpdate.call(this, id, { archived: true });
	return toExecutionData.call(this, response as IDataObject, i);
}

export async function unarchive(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const id = await resolveItemId.call(this, i);
	const response = await mergedEntityUpdate.call(this, id, { archived: false });
	return toExecutionData.call(this, response as IDataObject, i);
}

export async function exportCsv(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
	const csv = (await homeboxApiRequest.call(this, 'GET', '/entities/export', undefined, {}, {
		text: true,
	})) as string;
	const binary = await this.helpers.prepareBinaryData(
		Buffer.from(csv, 'utf8'),
		'homebox-inventory.csv',
		'text/csv',
	);
	return [
		{
			json: { fileName: 'homebox-inventory.csv', size: Buffer.byteLength(csv, 'utf8') },
			binary: { [binaryPropertyName]: binary },
			pairedItem: { item: i },
		},
	];
}
