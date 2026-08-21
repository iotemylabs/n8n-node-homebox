import type { IDataObject } from 'n8n-workflow';

// Shapes below mirror docs/homebox-openapi.json (sysadminsmedia/homebox v0.26.2,
// commit e01dd737). Only the fields the node actually reads are typed strictly;
// everything else rides along as IDataObject.

export interface HomeboxTagSummary extends IDataObject {
	id: string;
	name: string;
	parentId?: string;
}

export interface HomeboxEntityTypeSummary extends IDataObject {
	id: string;
	name: string;
	isLocation: boolean;
}

export interface HomeboxAttachment extends IDataObject {
	id: string;
	title: string;
	type: string;
	mimeType: string;
	primary: boolean;
}

export interface HomeboxEntitySummary extends IDataObject {
	id: string;
	name: string;
	assetId?: string;
	archived?: boolean;
	createdAt: string;
	updatedAt: string;
	parent?: HomeboxEntitySummary | null;
	entityType?: HomeboxEntityTypeSummary | null;
	tags?: HomeboxTagSummary[];
}

export interface HomeboxEntityFieldData extends IDataObject {
	id?: string;
	name: string;
	type: string;
	textValue?: string;
	numberValue?: number;
	booleanValue?: boolean;
}

export interface HomeboxEntityOut extends HomeboxEntitySummary {
	description?: string;
	quantity?: number;
	insured?: boolean;
	serialNumber?: string;
	modelNumber?: string;
	manufacturer?: string;
	notes?: string;
	purchaseFrom?: string;
	purchasePrice?: number;
	purchaseDate?: string;
	soldTo?: string;
	soldPrice?: number;
	soldDate?: string;
	soldNotes?: string;
	lifetimeWarranty?: boolean;
	warrantyExpires?: string;
	warrantyDetails?: string;
	syncChildEntityLocations?: boolean;
	fields?: HomeboxEntityFieldData[];
	attachments?: HomeboxAttachment[];
}

export interface HomeboxEntityListResult extends IDataObject {
	items: HomeboxEntitySummary[];
	total: number;
	page: number;
	pageSize: number;
	totalPrice?: number;
}

export interface HomeboxTreeItem extends IDataObject {
	id: string;
	name: string;
	type: 'location' | 'item';
	children?: HomeboxTreeItem[] | null;
}

export interface HomeboxMaintenanceEntry extends IDataObject {
	id: string;
	name: string;
	description?: string;
	cost?: string;
	completedDate?: string;
	scheduledDate?: string;
	itemID?: string;
	itemName?: string;
}

// The full-replace PUT payload. Every field the server writes unconditionally
// (see docs/API.md finding 4) must be present here when updating.
export interface HomeboxEntityUpdatePayload extends IDataObject {
	id: string;
	name: string;
	description: string;
	quantity: number;
	archived: boolean;
	insured: boolean;
	assetId: string;
	serialNumber: string;
	modelNumber: string;
	manufacturer: string;
	notes: string;
	purchaseFrom: string;
	purchasePrice: number;
	purchaseDate: string;
	soldTo: string;
	soldPrice: number;
	soldDate: string;
	soldNotes: string;
	lifetimeWarranty: boolean;
	warrantyExpires: string;
	warrantyDetails: string;
	syncChildEntityLocations: boolean;
	parentId: string | null;
	entityTypeId?: string;
	tagIds: string[];
	fields: HomeboxEntityFieldData[];
}
