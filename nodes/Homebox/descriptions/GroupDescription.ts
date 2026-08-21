import type { INodeProperties } from 'n8n-workflow';

export const groupOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['group'],
			},
		},
		options: [
			{
				name: 'Get',
				value: 'get',
				action: 'Get the current group',
				description: 'Get the group the API key belongs to (name, currency)',
			},
			{
				name: 'Get Invitation Token',
				value: 'getInvitationToken',
				action: 'Create a group invitation token',
			},
			{
				name: 'Get Statistics',
				value: 'getStatistics',
				action: 'Get group statistics',
			},
		],
		default: 'get',
	},
];

export const groupFields: INodeProperties[] = [
	// ----------------------------------
	//         group:getStatistics
	// ----------------------------------
	{
		displayName: 'Report',
		name: 'report',
		type: 'options',
		options: [
			{
				name: 'Purchase Price Over Time',
				value: 'priceOverTime',
				description: 'Total inventory value over a date range',
			},
			{
				name: 'Totals',
				value: 'totals',
				description: 'Total items, locations, tags, users, value and items with warranty',
			},
			{
				name: 'Totals by Location',
				value: 'byLocation',
			},
			{
				name: 'Totals by Tag',
				value: 'byTag',
			},
		],
		default: 'totals',
		displayOptions: {
			show: {
				resource: ['group'],
				operation: ['getStatistics'],
			},
		},
	},
	{
		displayName: 'Start Date',
		name: 'start',
		type: 'string',
		default: '',
		placeholder: 'e.g. 2026-01-01',
		displayOptions: {
			show: {
				resource: ['group'],
				operation: ['getStatistics'],
				report: ['priceOverTime'],
			},
		},
	},
	{
		displayName: 'End Date',
		name: 'end',
		type: 'string',
		default: '',
		placeholder: 'e.g. 2026-12-31',
		displayOptions: {
			show: {
				resource: ['group'],
				operation: ['getStatistics'],
				report: ['priceOverTime'],
			},
		},
	},

	// ----------------------------------
	//         group:getInvitationToken
	// ----------------------------------
	{
		displayName: 'Uses',
		name: 'uses',
		type: 'number',
		typeOptions: {
			minValue: 1,
			maxValue: 100,
		},
		default: 1,
		required: true,
		description: 'How many times the invitation token can be used',
		displayOptions: {
			show: {
				resource: ['group'],
				operation: ['getInvitationToken'],
			},
		},
	},
	{
		displayName: 'Expires At',
		name: 'expiresAt',
		type: 'dateTime',
		default: '',
		description: 'When the invitation token expires. Leave empty for the server default.',
		displayOptions: {
			show: {
				resource: ['group'],
				operation: ['getInvitationToken'],
			},
		},
	},
];
