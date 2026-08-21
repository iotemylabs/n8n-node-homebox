import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { homeboxApiRequest, normalizeHomeboxDate } from '../GenericFunctions';
import type { HomeboxMaintenanceEntry } from '../types';
import { resolveItemId, toExecutionData } from './helpers';

export async function getAll(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const itemId = await resolveItemId.call(this, i);
	const status = this.getNodeParameter('status', i) as string;
	const entries = (await homeboxApiRequest.call(
		this,
		'GET',
		`/entities/${itemId}/maintenance`,
		undefined,
		{ status },
	)) as IDataObject[];
	return toExecutionData.call(this, entries, i);
}

export async function getAllGroup(
	this: IExecuteFunctions,
	i: number,
): Promise<INodeExecutionData[]> {
	const status = this.getNodeParameter('status', i) as string;
	const entries = (await homeboxApiRequest.call(this, 'GET', '/maintenance', undefined, {
		status,
	})) as IDataObject[];
	return toExecutionData.call(this, entries, i);
}

export async function create(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const itemId = await resolveItemId.call(this, i);
	const name = this.getNodeParameter('name', i) as string;
	const additionalFields = this.getNodeParameter('additionalFields', i, {}) as IDataObject;

	const body: IDataObject = { name };
	for (const key of ['description', 'cost', 'completedDate', 'scheduledDate'] as const) {
		if (additionalFields[key]) body[key] = additionalFields[key];
	}

	const response = await homeboxApiRequest.call(
		this,
		'POST',
		`/entities/${itemId}/maintenance`,
		body,
	);
	return toExecutionData.call(this, response as IDataObject, i);
}

export async function update(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const maintenanceId = this.getNodeParameter('maintenanceId', i) as string;
	const updateFields = this.getNodeParameter('updateFields', i, {}) as IDataObject;

	// The maintenance PUT writes every field unconditionally and the API has
	// no single-entry GET, so merge from the group-wide list.
	const entries = (await homeboxApiRequest.call(this, 'GET', '/maintenance', undefined, {
		status: 'both',
	})) as HomeboxMaintenanceEntry[];
	const current = entries.find((e) => e.id === maintenanceId);
	if (!current) {
		throw new NodeOperationError(
			this.getNode(),
			`Maintenance entry ${maintenanceId} not found`,
			{ itemIndex: i },
		);
	}

	const body: IDataObject = {
		name: (updateFields.name as string) || current.name,
		description:
			updateFields.description !== undefined
				? updateFields.description
				: (current.description ?? ''),
		cost: updateFields.cost !== undefined ? updateFields.cost : (current.cost ?? '0'),
		completedDate:
			updateFields.completedDate !== undefined
				? updateFields.completedDate
				: normalizeHomeboxDate(current.completedDate),
		scheduledDate:
			updateFields.scheduledDate !== undefined
				? updateFields.scheduledDate
				: normalizeHomeboxDate(current.scheduledDate),
	};

	const response = await homeboxApiRequest.call(this, 'PUT', `/maintenance/${maintenanceId}`, body);
	return toExecutionData.call(this, response as IDataObject, i);
}

export async function del(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const maintenanceId = this.getNodeParameter('maintenanceId', i) as string;
	await homeboxApiRequest.call(this, 'DELETE', `/maintenance/${maintenanceId}`);
	return toExecutionData.call(this, { success: true, id: maintenanceId }, i);
}
