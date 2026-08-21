import type { INodeProperties } from 'n8n-workflow';

import { makeItemLocator } from './shared';

export const attachmentOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['attachment'],
			},
		},
		options: [
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete an attachment',
				description: 'Permanently delete an attachment file from an item. This is irreversible.',
			},
			{
				name: 'Download',
				value: 'download',
				action: 'Download an attachment',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many attachments of an item',
				description: 'List the attachments of an item (metadata only)',
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update attachment metadata',
				description: 'Update the title, type or primary flag of an attachment',
			},
			{
				name: 'Upload',
				value: 'upload',
				action: 'Upload an attachment',
			},
		],
		default: 'getAll',
	},
];

const attachmentTypeOptions = [
	{ name: 'Attachment', value: 'attachment' },
	{ name: 'Manual', value: 'manual' },
	{ name: 'Photo', value: 'photo' },
	{ name: 'Receipt', value: 'receipt' },
	{ name: 'Warranty', value: 'warranty' },
];

export const attachmentFields: INodeProperties[] = [
	makeItemLocator(['attachment'], ['delete', 'download', 'getAll', 'update', 'upload']),
	{
		// eslint-disable-next-line n8n-nodes-base/node-param-display-name-wrong-for-dynamic-options
		displayName: 'Attachment',
		name: 'attachmentId',
		type: 'options',
		typeOptions: {
			loadOptionsMethod: 'getAttachments',
			loadOptionsDependsOn: ['itemId.value'],
		},
		default: '',
		required: true,
		description:
			'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
		displayOptions: {
			show: {
				resource: ['attachment'],
				operation: ['delete', 'download', 'update'],
			},
		},
	},

	// ----------------------------------
	//         attachment:upload
	// ----------------------------------
	{
		displayName: 'Input Binary Field',
		name: 'binaryPropertyName',
		type: 'string',
		default: 'data',
		required: true,
		hint: 'The name of the input binary field containing the file to upload',
		displayOptions: {
			show: {
				resource: ['attachment'],
				operation: ['upload'],
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
				resource: ['attachment'],
				operation: ['upload'],
			},
		},
		options: [
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'Title of the attachment. Defaults to the file name of the binary data.',
			},
			{
				displayName: 'Primary',
				name: 'primary',
				type: 'boolean',
				default: false,
				description: 'Whether this attachment becomes the primary photo of the item',
			},
			{
				displayName: 'Type',
				name: 'type',
				type: 'options',
				options: attachmentTypeOptions,
				default: 'attachment',
			},
		],
	},

	// ----------------------------------
	//         attachment:download
	// ----------------------------------
	{
		displayName: 'Put Output in Field',
		name: 'binaryPropertyName',
		type: 'string',
		default: 'data',
		hint: 'The name of the output binary field to put the file in',
		displayOptions: {
			show: {
				resource: ['attachment'],
				operation: ['download'],
			},
		},
	},

	// ----------------------------------
	//         attachment:update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				resource: ['attachment'],
				operation: ['update'],
			},
		},
		options: [
			{
				displayName: 'Primary',
				name: 'primary',
				type: 'boolean',
				default: false,
				description: 'Whether this attachment becomes the primary photo of the item',
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Type',
				name: 'type',
				type: 'options',
				options: attachmentTypeOptions,
				default: 'attachment',
			},
		],
	},
];
