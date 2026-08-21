import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import * as attachment from './attachment';
import * as group from './group';
import * as item from './item';
import * as location from './location';
import * as maintenance from './maintenance';
import * as tag from './tag';

type OperationHandler = (this: IExecuteFunctions, i: number) => Promise<INodeExecutionData[]>;

const handlers: Record<string, Record<string, OperationHandler>> = {
	item: {
		archive: item.archive,
		create: item.create,
		delete: item.del,
		duplicate: item.duplicate,
		exportCsv: item.exportCsv,
		get: item.get,
		getAll: item.getAll,
		getPath: item.getPath,
		unarchive: item.unarchive,
		update: item.update,
	},
	location: {
		create: location.create,
		delete: location.del,
		get: location.get,
		getAll: location.getAll,
		getItems: location.getItems,
		getPath: location.getPath,
		getTree: location.getTree,
		update: location.update,
	},
	tag: {
		create: tag.create,
		delete: tag.del,
		get: tag.get,
		getAll: tag.getAll,
		getItems: tag.getItems,
		update: tag.update,
	},
	attachment: {
		delete: attachment.del,
		download: attachment.download,
		getAll: attachment.getAll,
		update: attachment.update,
		upload: attachment.upload,
	},
	maintenance: {
		create: maintenance.create,
		delete: maintenance.del,
		getAll: maintenance.getAll,
		getAllGroup: maintenance.getAllGroup,
		update: maintenance.update,
	},
	group: {
		get: group.get,
		getInvitationToken: group.getInvitationToken,
		getStatistics: group.getStatistics,
	},
};

/**
 * Dispatches every input item to its resource/operation handler. Honors
 * continueOnFail by pushing { json: { error } } instead of throwing.
 */
export async function router(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
	const items = this.getInputData();
	const returnData: INodeExecutionData[] = [];

	const resource = this.getNodeParameter('resource', 0) as string;
	const operation = this.getNodeParameter('operation', 0) as string;

	const handler = handlers[resource]?.[operation];
	if (!handler) {
		throw new NodeOperationError(
			this.getNode(),
			`The operation "${operation}" is not supported for resource "${resource}"`,
		);
	}

	const continueOnFail = this.continueOnFail();
	for (let i = 0; i < items.length; i++) {
		if (!continueOnFail) {
			// Errors are already NodeApiError/NodeOperationError (mapped in
			// GenericFunctions) and propagate untouched.
			returnData.push(...(await handler.call(this, i)));
			continue;
		}
		try {
			returnData.push(...(await handler.call(this, i)));
		} catch (error) {
			returnData.push({
				json: { error: error instanceof Error ? error.message : String(error) },
				pairedItem: { item: i },
			});
		}
	}

	return [returnData];
}
