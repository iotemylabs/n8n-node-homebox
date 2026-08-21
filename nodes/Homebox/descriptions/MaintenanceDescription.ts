import type { INodeProperties } from 'n8n-workflow';

import { makeItemLocator } from './shared';

export const maintenanceOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['maintenance'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create a maintenance entry',
				description: 'Log or schedule maintenance for an item',
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a maintenance entry',
				description: 'Permanently delete a maintenance entry. This is irreversible.',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many maintenance entries of an item',
			},
			{
				name: 'Get Many (Group)',
				value: 'getAllGroup',
				action: 'Get many maintenance entries across all items',
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a maintenance entry',
				description:
					'Update a maintenance entry. Only the fields you set are changed — everything else is preserved.',
			},
		],
		default: 'getAll',
	},
];

const maintenanceEditableFields: INodeProperties[] = [
	{
		displayName: 'Completed Date',
		name: 'completedDate',
		type: 'string',
		default: '',
		placeholder: 'e.g. 2026-01-31',
		description: 'When the maintenance was completed (YYYY-MM-DD). Leave empty if only scheduled.',
	},
	{
		displayName: 'Cost',
		name: 'cost',
		type: 'string',
		default: '',
		placeholder: 'e.g. 49.99',
		description: 'Cost of the maintenance. Homebox stores this as a decimal string.',
	},
	{
		displayName: 'Description',
		name: 'description',
		type: 'string',
		default: '',
	},
	{
		displayName: 'Scheduled Date',
		name: 'scheduledDate',
		type: 'string',
		default: '',
		placeholder: 'e.g. 2026-06-01',
		description: 'When the maintenance is due (YYYY-MM-DD)',
	},
];

export const maintenanceFields: INodeProperties[] = [
	makeItemLocator(['maintenance'], ['create', 'getAll']),
	{
		displayName: 'Maintenance Entry ID',
		name: 'maintenanceId',
		type: 'string',
		default: '',
		required: true,
		description:
			'The ID of the maintenance entry, as returned by the Get Many operations',
		displayOptions: {
			show: {
				resource: ['maintenance'],
				operation: ['delete', 'update'],
			},
		},
	},
	{
		displayName: 'Status',
		name: 'status',
		type: 'options',
		options: [
			{ name: 'Both', value: 'both' },
			{ name: 'Completed', value: 'completed' },
			{ name: 'Scheduled', value: 'scheduled' },
		],
		default: 'both',
		description: 'Which maintenance entries to return',
		displayOptions: {
			show: {
				resource: ['maintenance'],
				operation: ['getAll', 'getAllGroup'],
			},
		},
	},

	// ----------------------------------
	//         maintenance:create
	// ----------------------------------
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		required: true,
		description: 'Short name of the maintenance task, e.g. "Replace filter"',
		displayOptions: {
			show: {
				resource: ['maintenance'],
				operation: ['create'],
			},
		},
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['maintenance'],
				operation: ['create'],
			},
		},
		options: maintenanceEditableFields,
	},

	// ----------------------------------
	//         maintenance:update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		description:
			'Only the fields you set here change. The node looks the entry up and merges your changes before writing.',
		displayOptions: {
			show: {
				resource: ['maintenance'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
			},
			...maintenanceEditableFields,
		],
	},
];
