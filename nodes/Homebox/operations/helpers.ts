import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { homeboxApiRequest } from '../GenericFunctions';
import type { HomeboxEntityFieldData, HomeboxEntityListResult } from '../types';

/**
 * Resolves the item resourceLocator (From list / By ID / By asset ID) to a
 * plain entity UUID. Asset IDs go through GET /assets/{id}.
 */
export async function resolveItemId(this: IExecuteFunctions, i: number): Promise<string> {
	const locator = this.getNodeParameter('itemId', i) as {
		mode: string;
		value: string;
	};
	const value = (locator.value ?? '').toString().trim();

	if (locator.mode !== 'assetId') {
		if (!value) {
			throw new NodeOperationError(this.getNode(), 'No item selected', { itemIndex: i });
		}
		return value;
	}

	const assetId = value.replace(/^#/, '');
	const result = (await homeboxApiRequest.call(
		this,
		'GET',
		`/assets/${assetId}`,
	)) as HomeboxEntityListResult;
	const first = result.items?.[0];
	if (!first) {
		throw new NodeOperationError(this.getNode(), `No item found with asset ID ${assetId}`, {
			itemIndex: i,
		});
	}
	return first.id;
}

/**
 * Converts the customFields fixedCollection UI value into the API's typed
 * field entries.
 */
export function parseCustomFieldsParameter(
	customFields: IDataObject | undefined,
): HomeboxEntityFieldData[] {
	const rows = ((customFields?.field as IDataObject[]) ?? []).filter((r) => r.name);
	return rows.map((row) => {
		const type = (row.type as string) ?? 'text';
		const raw = (row.value ?? '').toString();
		const field: HomeboxEntityFieldData = { name: row.name as string, type };
		if (type === 'number') {
			field.numberValue = Number.parseInt(raw, 10) || 0;
		} else if (type === 'boolean') {
			field.booleanValue = ['true', '1', 'yes'].includes(raw.toLowerCase());
		} else {
			field.textValue = raw;
		}
		return field;
	});
}

/**
 * Merges custom-field changes into the item's existing fields by name, so
 * setting one field never drops the others.
 */
export function mergeCustomFields(
	current: HomeboxEntityFieldData[],
	changes: HomeboxEntityFieldData[],
): HomeboxEntityFieldData[] {
	const merged = [...current];
	for (const change of changes) {
		const existing = merged.findIndex((f) => f.name === change.name);
		if (existing >= 0) {
			merged[existing] = { ...merged[existing], ...change };
		} else {
			merged.push(change);
		}
	}
	return merged;
}

export function toExecutionData(
	this: IExecuteFunctions,
	data: IDataObject | IDataObject[],
	i: number,
): INodeExecutionData[] {
	return this.helpers.constructExecutionMetaData(this.helpers.returnJsonArray(data), {
		itemData: { item: i },
	});
}
