import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { homeboxApiRequest } from '../GenericFunctions';
import { toExecutionData } from './helpers';

export async function get(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const response = await homeboxApiRequest.call(this, 'GET', '/groups');
	return toExecutionData.call(this, response as IDataObject, i);
}

export async function getStatistics(
	this: IExecuteFunctions,
	i: number,
): Promise<INodeExecutionData[]> {
	const report = this.getNodeParameter('report', i) as string;

	if (report === 'byLocation' || report === 'byTag') {
		const endpoint =
			report === 'byLocation' ? '/groups/statistics/locations' : '/groups/statistics/tags';
		const rows = (await homeboxApiRequest.call(this, 'GET', endpoint)) as IDataObject[];
		return toExecutionData.call(this, rows, i);
	}

	if (report === 'priceOverTime') {
		const qs: IDataObject = {};
		const start = this.getNodeParameter('start', i, '') as string;
		const end = this.getNodeParameter('end', i, '') as string;
		if (start) qs.start = start;
		if (end) qs.end = end;
		const response = await homeboxApiRequest.call(
			this,
			'GET',
			'/groups/statistics/purchase-price',
			undefined,
			qs,
		);
		return toExecutionData.call(this, response as IDataObject, i);
	}

	const response = await homeboxApiRequest.call(this, 'GET', '/groups/statistics');
	return toExecutionData.call(this, response as IDataObject, i);
}

export async function getInvitationToken(
	this: IExecuteFunctions,
	i: number,
): Promise<INodeExecutionData[]> {
	const uses = this.getNodeParameter('uses', i) as number;
	const expiresAt = this.getNodeParameter('expiresAt', i, '') as string;

	const body: IDataObject = { uses };
	if (expiresAt) body.expiresAt = expiresAt;

	const response = await homeboxApiRequest.call(this, 'POST', '/groups/invitations', body);
	return toExecutionData.call(this, response as IDataObject, i);
}
