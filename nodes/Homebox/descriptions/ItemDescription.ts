import type { INodeProperties } from 'n8n-workflow';

import {
	customFieldsCollection,
	makeIncludeArchived,
	makeItemLocator,
	makeLimit,
	makeReturnAll,
} from './shared';

export const itemOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['item'],
			},
		},
		options: [
			{
				name: 'Archive',
				value: 'archive',
				action: 'Archive an item',
				description: 'Mark an item as archived (hidden from default lists)',
			},
			{
				name: 'Create',
				value: 'create',
				action: 'Create an item',
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete an item',
				description:
					'Permanently delete an item. This is irreversible and also deletes its attachments, custom fields and maintenance log.',
			},
			{
				name: 'Duplicate',
				value: 'duplicate',
				action: 'Duplicate an item',
			},
			{
				name: 'Export CSV',
				value: 'exportCsv',
				action: 'Export all items as CSV',
				description: 'Export the whole inventory as a CSV file',
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get an item',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many items',
			},
			{
				name: 'Get Path',
				value: 'getPath',
				action: 'Get the location path of an item',
				description: 'Get the full location path of an item (e.g. Garage → Shelf B → Bin 3)',
			},
			{
				name: 'Unarchive',
				value: 'unarchive',
				action: 'Unarchive an item',
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update an item',
				description:
					'Update an item. Only the fields you set are changed — everything else is preserved.',
			},
		],
		default: 'get',
	},
];

const itemDateFields: Array<[string, string, string]> = [
	['Purchase Date', 'purchaseDate', 'Date the item was purchased (YYYY-MM-DD)'],
	['Sold Date', 'soldDate', 'Date the item was sold (YYYY-MM-DD)'],
	['Warranty Expires', 'warrantyExpires', 'Date the warranty expires (YYYY-MM-DD)'],
];

const commonItemFields = (withSold: boolean): INodeProperties[] => [
	{
		displayName: 'Description',
		name: 'description',
		type: 'string',
		default: '',
	},
	{
		displayName: 'Insured',
		name: 'insured',
		type: 'boolean',
		default: false,
		description: 'Whether the item is covered by insurance',
	},
	{
		displayName: 'Lifetime Warranty',
		name: 'lifetimeWarranty',
		type: 'boolean',
		default: false,
		description: 'Whether the item has a lifetime warranty',
	},
	{
		// eslint-disable-next-line n8n-nodes-base/node-param-display-name-wrong-for-dynamic-options
		displayName: 'Location',
		name: 'locationId',
		type: 'options',
		typeOptions: {
			loadOptionsMethod: 'getLocations',
		},
		default: '',
		description:
			'The location the item is stored in. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'Manufacturer',
		name: 'manufacturer',
		type: 'string',
		default: '',
	},
	{
		displayName: 'Model Number',
		name: 'modelNumber',
		type: 'string',
		default: '',
	},
	{
		displayName: 'Notes',
		name: 'notes',
		type: 'string',
		default: '',
	},
	...itemDateFields
		.filter(([, name]) => withSold || name !== 'soldDate')
		.map(
			([displayName, name, description]): INodeProperties => ({
				displayName,
				name,
				type: 'string',
				default: '',
				placeholder: 'e.g. 2026-01-31',
				description,
			}),
		),
	{
		displayName: 'Purchase From',
		name: 'purchaseFrom',
		type: 'string',
		default: '',
		description: 'Where the item was purchased',
	},
	{
		displayName: 'Purchase Price',
		name: 'purchasePrice',
		type: 'number',
		default: 0,
	},
	{
		displayName: 'Quantity',
		name: 'quantity',
		type: 'number',
		default: 1,
	},
	{
		displayName: 'Serial Number',
		name: 'serialNumber',
		type: 'string',
		default: '',
	},
	...(withSold
		? ([
				{
					displayName: 'Sold Notes',
					name: 'soldNotes',
					type: 'string',
					default: '',
				},
				{
					displayName: 'Sold Price',
					name: 'soldPrice',
					type: 'number',
					default: 0,
				},
				{
					displayName: 'Sold To',
					name: 'soldTo',
					type: 'string',
					default: '',
				},
			] as INodeProperties[])
		: []),
	{
		// eslint-disable-next-line n8n-nodes-base/node-param-display-name-wrong-for-dynamic-multi-options
		displayName: 'Tags',
		name: 'tagIds',
		type: 'multiOptions',
		typeOptions: {
			loadOptionsMethod: 'getTags',
		},
		default: [],
		description:
			'Tags to set on the item. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'Warranty Details',
		name: 'warrantyDetails',
		type: 'string',
		default: '',
	},
	customFieldsCollection(
		'Custom fields to set on the item. Existing custom fields with other names are preserved.',
	),
];

export const itemFields: INodeProperties[] = [
	makeItemLocator(
		['item'],
		['archive', 'delete', 'duplicate', 'get', 'getPath', 'unarchive', 'update'],
	),

	// ----------------------------------
	//         item:create
	// ----------------------------------
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				resource: ['item'],
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
		description:
			'The Homebox create endpoint only accepts a small set of fields; anything beyond description, location, quantity and tags is applied by the node with an immediate follow-up update after creation',
		displayOptions: {
			show: {
				resource: ['item'],
				operation: ['create'],
			},
		},
		options: commonItemFields(false),
	},

	// ----------------------------------
	//         item:update
	// ----------------------------------
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		description:
			'Only the fields you set here change. The node reads the current item and merges your changes before writing, so unspecified fields — including tags and location — are preserved.',
		displayOptions: {
			show: {
				resource: ['item'],
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
			...commonItemFields(true),
		],
	},

	// ----------------------------------
	//         item:getAll
	// ----------------------------------
	makeReturnAll(['item'], ['getAll']),
	makeLimit(['item'], ['getAll']),
	makeIncludeArchived(['item'], ['getAll']),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: {
			show: {
				resource: ['item'],
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Custom Field Filters',
				name: 'customFieldFilters',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				default: {},
				description: 'Only return items whose custom field matches a value exactly',
				options: [
					{
						displayName: 'Filter',
						name: 'filter',
						values: [
							{
								displayName: 'Field Name',
								name: 'name',
								type: 'string',
								default: '',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
							},
						],
					},
				],
			},
			{
				// eslint-disable-next-line n8n-nodes-base/node-param-display-name-wrong-for-dynamic-multi-options
				displayName: 'Locations',
				name: 'locationIds',
				type: 'multiOptions',
				typeOptions: {
					loadOptionsMethod: 'getLocations',
				},
				default: [],
				description:
					'Only return items in these locations. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Negate Tags',
				name: 'negateTags',
				type: 'boolean',
				default: false,
				description: 'Whether to return items that do NOT have the selected tags',
			},
			{
				displayName: 'Only With Photo',
				name: 'onlyWithPhoto',
				type: 'boolean',
				default: false,
				description: 'Whether to only return items that have a photo',
			},
			{
				displayName: 'Only Without Photo',
				name: 'onlyWithoutPhoto',
				type: 'boolean',
				default: false,
				description: 'Whether to only return items that have no photo',
			},
			{
				displayName: 'Search',
				name: 'search',
				type: 'string',
				default: '',
				description:
					'Free-text search. A value starting with # (e.g. #000-042) searches by asset ID.',
			},
			{
				displayName: 'Sort By',
				name: 'orderBy',
				type: 'options',
				options: [
					{ name: 'Asset ID', value: 'assetId' },
					{ name: 'Created At (Newest First)', value: 'createdAt' },
					{ name: 'Name', value: 'name' },
					{ name: 'Updated At (Newest First)', value: 'updatedAt' },
				],
				default: 'name',
			},
			{
				// eslint-disable-next-line n8n-nodes-base/node-param-display-name-wrong-for-dynamic-multi-options
				displayName: 'Tags',
				name: 'tagIds',
				type: 'multiOptions',
				typeOptions: {
					loadOptionsMethod: 'getTags',
				},
				default: [],
				description:
					'Only return items with these tags. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Top-Level Only',
				name: 'topLevelOnly',
				type: 'boolean',
				default: false,
				description: 'Whether to only return items that are not inside any location or container',
			},
		],
	},

	// ----------------------------------
	//         item:duplicate
	// ----------------------------------
	{
		displayName: 'Options',
		name: 'duplicateOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['item'],
				operation: ['duplicate'],
			},
		},
		options: [
			{
				displayName: 'Copy Attachments',
				name: 'copyAttachments',
				type: 'boolean',
				default: true,
				description: 'Whether to copy the attachments of the item',
			},
			{
				displayName: 'Copy Custom Fields',
				name: 'copyCustomFields',
				type: 'boolean',
				default: true,
				description: 'Whether to copy the custom fields of the item',
			},
			{
				displayName: 'Copy Maintenance Log',
				name: 'copyMaintenance',
				type: 'boolean',
				default: false,
				description: 'Whether to copy the maintenance entries of the item',
			},
			{
				displayName: 'Name Prefix',
				name: 'copyPrefix',
				type: 'string',
				default: 'Copy of ',
				description: 'Prefix for the name of the duplicated item',
			},
		],
	},

	// ----------------------------------
	//         item:exportCsv
	// ----------------------------------
	{
		displayName: 'Put Output in Field',
		name: 'binaryPropertyName',
		type: 'string',
		default: 'data',
		hint: 'The name of the output binary field to put the CSV file in',
		displayOptions: {
			show: {
				resource: ['item'],
				operation: ['exportCsv'],
			},
		},
	},
];
