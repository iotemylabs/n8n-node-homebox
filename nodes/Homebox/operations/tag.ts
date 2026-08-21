import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { homeboxApiRequest, homeboxApiRequestAllItems } from '../GenericFunctions';
import { toExecutionData } from './helpers';

const NIL_UUID = '00000000-0000-0000-0000-000000000000';

export async function get(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const id = this.getNodeParameter('tagId', i) as string;
	const response = await homeboxApiRequest.call(this, 'GET', `/tags/${id}`);
	return toExecutionData.call(this, response as IDataObject, i);
}

export async function getAll(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const response = (await homeboxApiRequest.call(this, 'GET', '/tags')) as IDataObject[];
	return toExecutionData.call(this, response, i);
}

export async function create(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const name = this.getNodeParameter('name', i) as string;
	const additionalFields = this.getNodeParameter('additionalFields', i, {}) as IDataObject;

	const body: IDataObject = { name };
	for (const key of ['color', 'description', 'icon', 'parentId'] as const) {
		if (additionalFields[key]) body[key] = additionalFields[key];
	}

	const response = await homeboxApiRequest.call(this, 'POST', '/tags', body);
	return toExecutionData.call(this, response as IDataObject, i);
}

export async function update(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const id = this.getNodeParameter('tagId', i) as string;
	const updateFields = this.getNodeParameter('updateFields', i, {}) as IDataObject;

	// The tag PUT requires name and writes every field, so merge from the
	// current tag to preserve anything the user did not set.
	const current = (await homeboxApiRequest.call(this, 'GET', `/tags/${id}`)) as IDataObject;
	const currentParentId =
		current.parentId && current.parentId !== NIL_UUID ? (current.parentId as string) : null;

	const body: IDataObject = {
		id,
		name: (updateFields.name as string) || (current.name as string),
		color: updateFields.color !== undefined ? updateFields.color : (current.color ?? ''),
		description:
			updateFields.description !== undefined
				? updateFields.description
				: (current.description ?? ''),
		icon: updateFields.icon !== undefined ? updateFields.icon : (current.icon ?? ''),
		parentId:
			updateFields.parentId !== undefined && updateFields.parentId !== ''
				? updateFields.parentId
				: currentParentId,
	};

	const response = await homeboxApiRequest.call(this, 'PUT', `/tags/${id}`, body);
	return toExecutionData.call(this, response as IDataObject, i);
}

export async function del(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const id = this.getNodeParameter('tagId', i) as string;
	await homeboxApiRequest.call(this, 'DELETE', `/tags/${id}`);
	return toExecutionData.call(this, { success: true, id }, i);
}

export async function getItems(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const id = this.getNodeParameter('tagId', i) as string;
	const returnAll = this.getNodeParameter('returnAll', i) as boolean;
	const limit = returnAll ? 0 : (this.getNodeParameter('limit', i) as number);
	const includeArchived = this.getNodeParameter('includeArchived', i) as boolean;

	const qs: IDataObject = { tags: [id] };
	if (includeArchived) qs.includeArchived = 'true';

	const items = await homeboxApiRequestAllItems.call(this, qs, returnAll, limit);
	return toExecutionData.call(this, items as IDataObject[], i);
}
