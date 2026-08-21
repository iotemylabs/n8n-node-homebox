import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { buildMultipartBody, homeboxApiRequest } from '../GenericFunctions';
import type { HomeboxAttachment, HomeboxEntityOut } from '../types';
import { resolveItemId, toExecutionData } from './helpers';

async function getAttachmentMeta(
	this: IExecuteFunctions,
	itemId: string,
	attachmentId: string,
	i: number,
): Promise<HomeboxAttachment> {
	const entity = (await homeboxApiRequest.call(
		this,
		'GET',
		`/entities/${itemId}`,
	)) as HomeboxEntityOut;
	const meta = (entity.attachments ?? []).find((a) => a.id === attachmentId);
	if (!meta) {
		throw new NodeOperationError(
			this.getNode(),
			`Attachment ${attachmentId} not found on item ${entity.name}`,
			{ itemIndex: i },
		);
	}
	return meta;
}

export async function getAll(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const itemId = await resolveItemId.call(this, i);
	const entity = (await homeboxApiRequest.call(
		this,
		'GET',
		`/entities/${itemId}`,
	)) as HomeboxEntityOut;
	const attachments = (entity.attachments ?? []).map((a) => ({ ...a, itemId: entity.id }));
	return toExecutionData.call(this, attachments as IDataObject[], i);
}

export async function upload(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const itemId = await resolveItemId.call(this, i);
	const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
	const additionalFields = this.getNodeParameter('additionalFields', i, {}) as IDataObject;

	const binaryMeta = this.helpers.assertBinaryData(i, binaryPropertyName);
	const buffer = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);

	const fileName = binaryMeta.fileName ?? 'file';
	const title = (additionalFields.name as string) || fileName;

	const { body, contentType } = buildMultipartBody([
		{
			fieldName: 'file',
			buffer,
			filename: fileName,
			contentType: binaryMeta.mimeType || 'application/octet-stream',
		},
		{ fieldName: 'name', value: title },
		{ fieldName: 'type', value: (additionalFields.type as string) ?? 'attachment' },
		{ fieldName: 'primary', value: additionalFields.primary ? 'true' : 'false' },
	]);

	const response = await homeboxApiRequest.call(
		this,
		'POST',
		`/entities/${itemId}/attachments`,
		undefined,
		{},
		{ rawBody: body, contentType },
	);
	return toExecutionData.call(this, response as IDataObject, i);
}

export async function download(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const itemId = await resolveItemId.call(this, i);
	const attachmentId = this.getNodeParameter('attachmentId', i) as string;
	const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;

	const meta = await getAttachmentMeta.call(this, itemId, attachmentId, i);

	const response = (await homeboxApiRequest.call(
		this,
		'GET',
		`/entities/${itemId}/attachments/${attachmentId}`,
		undefined,
		{},
		{ binary: true },
	)) as { headers?: IDataObject; body: ArrayBuffer };

	const contentType =
		(response.headers?.['content-type'] as string) || meta.mimeType || 'application/octet-stream';
	const binary = await this.helpers.prepareBinaryData(
		Buffer.from(response.body as ArrayBuffer),
		meta.title || attachmentId,
		contentType,
	);

	return [
		{
			json: meta as IDataObject,
			binary: { [binaryPropertyName]: binary },
			pairedItem: { item: i },
		},
	];
}

export async function update(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const itemId = await resolveItemId.call(this, i);
	const attachmentId = this.getNodeParameter('attachmentId', i) as string;
	const updateFields = this.getNodeParameter('updateFields', i, {}) as IDataObject;

	// Merge from the current metadata so unset fields are preserved.
	const meta = await getAttachmentMeta.call(this, itemId, attachmentId, i);
	const body: IDataObject = {
		title: updateFields.title !== undefined ? updateFields.title : meta.title,
		type: updateFields.type !== undefined ? updateFields.type : meta.type,
		primary: updateFields.primary !== undefined ? updateFields.primary : meta.primary,
	};

	const response = await homeboxApiRequest.call(
		this,
		'PUT',
		`/entities/${itemId}/attachments/${attachmentId}`,
		body,
	);
	return toExecutionData.call(this, response as IDataObject, i);
}

export async function del(this: IExecuteFunctions, i: number): Promise<INodeExecutionData[]> {
	const itemId = await resolveItemId.call(this, i);
	const attachmentId = this.getNodeParameter('attachmentId', i) as string;
	await homeboxApiRequest.call(this, 'DELETE', `/entities/${itemId}/attachments/${attachmentId}`);
	return toExecutionData.call(this, { success: true, id: attachmentId, itemId }, i);
}
