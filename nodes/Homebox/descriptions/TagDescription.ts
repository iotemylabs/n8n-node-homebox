import type { INodeProperties } from 'n8n-workflow';

import { makeIncludeArchived, makeLimit, makeReturnAll } from './shared';

export const tagOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['tag'],
			},
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create a tag',
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a tag',
				description:
					'Permanently delete a tag. This is irreversible. Items keep existing — they just lose this tag.',
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a tag',
			},
			{
				name: 'Get Items',
				value: 'getItems',
				action: 'Get the items with a tag',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many tags',
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a tag',
				description:
					'Update a tag. Only the fields you set are changed — everything else is preserved.',
			},
		],
		default: 'getAll',
	},
];

const tagEditableFields: INodeProperties[] = [
	{
		displayName: 'Color',
		name: 'color',
		type: 'color',
		default: '',
		description: 'Display color of the tag, e.g. #1976d2',
	},
	{
		displayName: 'Description',
		name: 'description',
		type: 'string',
		default: '',
	},
	{
		displayName: 'Icon',
		name: 'icon',
		type: 'string',
		default: '',
		description: 'Material Design Icons name shown next to the tag, e.g. tag-outline',
	},
	{
		// eslint-disable-next-line n8n-nodes-base/node-param-display-name-wrong-for-dynamic-options
		displayName: 'Parent Tag',
		name: 'parentId',
		type: 'options',
		typeOptions: {
			loadOptionsMethod: 'getTags',
		},
		default: '',
		description:
			'The tag this one nests under. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
];

export const tagFields: INodeProperties[] = [
	{
		// eslint-disable-next-line n8n-nodes-base/node-param-display-name-wrong-for-dynamic-options
		displayName: 'Tag',
		name: 'tagId',
		type: 'options',
		typeOptions: {
			loadOptionsMethod: 'getTags',
		},
		default: '',
		required: true,
		description:
			'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
		displayOptions: {
			show: {
				resource: ['tag'],
				operation: ['delete', 'get', 'getItems', 'update'],
			},
		},
	},

	// ----------------------------------
	//         tag:create
	// ----------------------------------
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				resource: ['tag'],
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
				resource: ['tag'],
				operation: ['create'],
			},
		},
		options: tagEditableFields,
	},

	// ----------------------------------
	//         tag:update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		description:
			'Only the fields you set here change. The node reads the current tag and merges your changes before writing.',
		displayOptions: {
			show: {
				resource: ['tag'],
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
			...tagEditableFields,
		],
	},

	// ----------------------------------
	//         tag:getItems
	// ----------------------------------
	makeReturnAll(['tag'], ['getItems']),
	makeLimit(['tag'], ['getItems']),
	makeIncludeArchived(['tag'], ['getItems']),
];
