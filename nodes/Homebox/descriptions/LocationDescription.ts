import type { INodeProperties } from 'n8n-workflow';

import { makeIncludeArchived, makeLimit, makeReturnAll } from './shared';

export const locationOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['location'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create a location',
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a location',
				description:
					'Permanently delete a location. This is irreversible. Items and sub-locations inside it are NOT deleted, but they lose their place in the tree (their parent is cleared).',
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a location',
			},
			{
				name: 'Get Items',
				value: 'getItems',
				action: 'Get the items in a location',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many locations',
			},
			{
				name: 'Get Path',
				value: 'getPath',
				action: 'Get the full path of a location',
			},
			{
				name: 'Get Tree',
				value: 'getTree',
				action: 'Get the location tree',
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a location',
				description:
					'Update a location. Only the fields you set are changed — everything else is preserved.',
			},
		],
		default: 'getAll',
	},
];

export const locationFields: INodeProperties[] = [
	{
		// eslint-disable-next-line n8n-nodes-base/node-param-display-name-wrong-for-dynamic-options
		displayName: 'Location',
		name: 'locationId',
		type: 'options',
		typeOptions: {
			loadOptionsMethod: 'getLocations',
		},
		default: '',
		required: true,
		description:
			'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
		displayOptions: {
			show: {
				resource: ['location'],
				operation: ['delete', 'get', 'getItems', 'getPath', 'update'],
			},
		},
	},

	// ----------------------------------
	//         location:create
	// ----------------------------------
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				resource: ['location'],
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
				resource: ['location'],
				operation: ['create'],
			},
		},
		options: [
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				default: '',
			},
			{
				// eslint-disable-next-line n8n-nodes-base/node-param-display-name-wrong-for-dynamic-options
				displayName: 'Parent Location',
				name: 'parentId',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getLocations',
				},
				default: '',
				description:
					'The location this one nests under. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
		],
	},

	// ----------------------------------
	//         location:update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		description:
			'Only the fields you set here change. The node reads the current location and merges your changes before writing.',
		displayOptions: {
			show: {
				resource: ['location'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
			},
			{
				// eslint-disable-next-line n8n-nodes-base/node-param-display-name-wrong-for-dynamic-options
				displayName: 'Parent Location',
				name: 'parentId',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getLocations',
				},
				default: '',
				description:
					'The location this one nests under. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
		],
	},

	// ----------------------------------
	//         location:getAll
	// ----------------------------------
	makeReturnAll(['location'], ['getAll', 'getItems']),
	makeLimit(['location'], ['getAll', 'getItems']),
	makeIncludeArchived(['location'], ['getAll', 'getItems']),
	{
		displayName: 'Top-Level Only',
		name: 'topLevelOnly',
		type: 'boolean',
		default: false,
		description: 'Whether to only return locations that are not nested inside another location',
		displayOptions: {
			show: {
				resource: ['location'],
				operation: ['getAll'],
			},
		},
	},

	// ----------------------------------
	//         location:getItems
	// ----------------------------------
	{
		displayName: 'Include Sub-Locations',
		name: 'includeSubtree',
		type: 'boolean',
		default: false,
		description:
			'Whether to also return items stored in locations nested under the selected one',
		displayOptions: {
			show: {
				resource: ['location'],
				operation: ['getItems'],
			},
		},
	},

	// ----------------------------------
	//         location:getTree
	// ----------------------------------
	{
		displayName: 'Include Items',
		name: 'withItems',
		type: 'boolean',
		default: false,
		description: 'Whether the tree should include the items inside each location',
		displayOptions: {
			show: {
				resource: ['location'],
				operation: ['getTree'],
			},
		},
	},
];
