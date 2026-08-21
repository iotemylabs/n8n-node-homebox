import type { INodeProperties } from 'n8n-workflow';

/**
 * Item picker used by the Item, Attachment and Maintenance resources.
 * Modes: pick from a live-searched list, paste the UUID, or use the Homebox
 * asset ID (e.g. 000-042).
 */
export const makeItemLocator = (
	resources: string[],
	operations: string[],
): INodeProperties => ({
	displayName: 'Item',
	name: 'itemId',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	displayOptions: {
		show: {
			resource: resources,
			operation: operations,
		},
	},
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			typeOptions: {
				searchListMethod: 'searchItems',
				searchable: true,
			},
		},
		{
			displayName: 'By ID',
			name: 'id',
			type: 'string',
			placeholder: 'e.g. 9c844a43-1bed-4409-bf95-b9e9123104ef',
			validation: [
				{
					type: 'regex',
					properties: {
						regex: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
						errorMessage: 'Not a valid UUID',
					},
				},
			],
		},
		{
			displayName: 'By Asset ID',
			name: 'assetId',
			type: 'string',
			placeholder: 'e.g. 000-042',
			hint: 'The Homebox asset ID shown on the item and on printed labels',
			validation: [
				{
					type: 'regex',
					properties: {
						regex: '^#?\\d+-\\d+$',
						errorMessage: 'Asset IDs look like 000-042',
					},
				},
			],
		},
	],
});

export const makeReturnAll = (
	resources: string[],
	operations: string[],
): INodeProperties => ({
	displayName: 'Return All',
	name: 'returnAll',
	type: 'boolean',
	default: false,
	description: 'Whether to return all results or only up to a given limit',
	displayOptions: {
		show: {
			resource: resources,
			operation: operations,
		},
	},
});

export const makeLimit = (resources: string[], operations: string[]): INodeProperties => ({
	displayName: 'Limit',
	name: 'limit',
	type: 'number',
	typeOptions: {
		minValue: 1,
	},
	default: 50,
	description: 'Max number of results to return',
	displayOptions: {
		show: {
			resource: resources,
			operation: operations,
			returnAll: [false],
		},
	},
});

export const makeIncludeArchived = (
	resources: string[],
	operations: string[],
): INodeProperties => ({
	displayName: 'Include Archived',
	name: 'includeArchived',
	type: 'boolean',
	default: false,
	description:
		'Whether to include archived items. Homebox excludes archived items from every list by default, so leaving this off can hide part of the inventory.',
	displayOptions: {
		show: {
			resource: resources,
			operation: operations,
		},
	},
});

export const customFieldsCollection = (description: string): INodeProperties => ({
	displayName: 'Custom Fields',
	name: 'customFields',
	type: 'fixedCollection',
	typeOptions: {
		multipleValues: true,
	},
	default: {},
	description,
	options: [
		{
			displayName: 'Field',
			name: 'field',
			values: [
				{
					displayName: 'Name',
					name: 'name',
					type: 'string',
					default: '',
					description: 'Name of the custom field',
				},
				{
					displayName: 'Type',
					name: 'type',
					type: 'options',
					options: [
						{ name: 'Boolean', value: 'boolean' },
						{ name: 'Number', value: 'number' },
						{ name: 'Text', value: 'text' },
						{ name: 'Time', value: 'time' },
					],
					default: 'text',
				},
				{
					displayName: 'Value',
					name: 'value',
					type: 'string',
					default: '',
					description:
						'Field value. For boolean fields use true/false, for number fields a number.',
				},
			],
		},
	],
});
