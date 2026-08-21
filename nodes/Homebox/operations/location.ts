import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	getEntityTypeId,
	getLocationSubtreeIds,
	homeboxApiRequest,
	homeboxApiRequestAllItems,
	mergedEntityUpdate,
} from '../GenericFunctions';
import type { HomeboxEntityUpdatePayload, HomeboxTreeItem } from '../types';
import { toExecutionData } from './helpers';

export async function get(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const id = this.getNodeParameter('locationId', i) as string;
	const response = await homeboxApiRequest.call(this, 'GET', `/entities/${id}`);
	return toExecutionData.call(this, response as IDataObject, i);
}

export async function getAll(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const returnAll = this.getNodeParameter('returnAll', i) as boolean;
	const limit = returnAll ? 0 : (this.getNodeParameter('limit', i) as number);
	const includeArchived = this.getNodeParameter('includeArchived', i) as boolean;
	const topLevelOnly = this.getNodeParameter('topLevelOnly', i, false) as boolean;

	const qs: IDataObject = { isLocation: 'true' };
	if (includeArchived) qs.includeArchived = 'true';
	if (topLevelOnly) qs.filterChildren = 'true';

	const locations = await homeboxApiRequestAllItems.call(this, qs, returnAll, limit);
	return toExecutionData.call(this, locations as IDataObject[], i);
}

export async function getTree(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const withItems = this.getNodeParameter('withItems', i, false) as boolean;
	const qs: IDataObject = {};
	if (withItems) qs.withItems = 'true';
	const tree = (await homeboxApiRequest.call(
		this,
		'GET',
		'/entities/tree',
		undefined,
		qs,
	)) as HomeboxTreeItem[];
	return toExecutionData.call(this, tree as IDataObject[], i);
}

export async function create(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const name = this.getNodeParameter('name', i) as string;
	const additionalFields = this.getNodeParameter('additionalFields', i, {}) as IDataObject;

	const entityTypeId = await getEntityTypeId.call(this, true);
	if (!entityTypeId) {
		throw new NodeOperationError(
			this.getNode(),
			'No location entity type found on this Homebox instance',
			{ itemIndex: i },
		);
	}

	const body: IDataObject = { name, entityTypeId };
	if (additionalFields.description) body.description = additionalFields.description;
	if (additionalFields.parentId) body.parentId = additionalFields.parentId;

	const response = await homeboxApiRequest.call(this, 'POST', '/entities', body);
	return toExecutionData.call(this, response as IDataObject, i);
}

export async function update(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const id = this.getNodeParameter('locationId', i) as string;
	const updateFields = this.getNodeParameter('updateFields', i, {}) as IDataObject;

	const changes: Partial<HomeboxEntityUpdatePayload> = {};
	if (updateFields.name !== undefined && updateFields.name !== '') {
		changes.name = updateFields.name as string;
	}
	if (updateFields.description !== undefined) {
		changes.description = updateFields.description as string;
	}
	if (updateFields.parentId !== undefined && updateFields.parentId !== '') {
		changes.parentId = updateFields.parentId as string;
	}

	const response = await mergedEntityUpdate.call(this, id, changes);
	return toExecutionData.call(this, response as IDataObject, i);
}

export async function del(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const id = this.getNodeParameter('locationId', i) as string;
	await homeboxApiRequest.call(this, 'DELETE', `/entities/${id}`);
	return toExecutionData.call(this, { success: true, id }, i);
}

export async function getPath(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const id = this.getNodeParameter('locationId', i) as string;
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

export async function getItems(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const id = this.getNodeParameter('locationId', i) as string;
	const returnAll = this.getNodeParameter('returnAll', i) as boolean;
	const limit = returnAll ? 0 : (this.getNodeParameter('limit', i) as number);
	const includeArchived = this.getNodeParameter('includeArchived', i) as boolean;
	const includeSubtree = this.getNodeParameter('includeSubtree', i, false) as boolean;

	const parentIds = includeSubtree ? await getLocationSubtreeIds.call(this, [id]) : [id];

	const qs: IDataObject = { parentIds };
	if (includeArchived) qs.includeArchived = 'true';

	const items = await homeboxApiRequestAllItems.call(this, qs, returnAll, limit);
	return toExecutionData.call(this, items as IDataObject[], i);
}
