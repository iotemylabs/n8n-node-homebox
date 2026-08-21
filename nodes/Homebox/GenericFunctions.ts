import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	IPollFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

import type {
	HomeboxEntityFieldData,
	HomeboxEntityListResult,
	HomeboxEntityOut,
	HomeboxEntitySummary,
	HomeboxEntityTypeSummary,
	HomeboxEntityUpdatePayload,
	HomeboxTagSummary,
	HomeboxTreeItem,
} from './types';

export type HomeboxContext =
	| IExecuteFunctions
	| ILoadOptionsFunctions
	| IPollFunctions
	| IHookFunctions;

const TARGET_FORK = 'sysadminsmedia/homebox (spec pinned at v0.26.2)';

/**
 * Reads and normalises the base URL from the credential: trailing slashes are
 * stripped, and a URL that already ends in /api (or /api/v1) is rejected
 * because the node appends /api/v1 itself.
 */
export async function getHomeboxBaseUrl(this: HomeboxContext): Promise<string> {
	const credentials = await this.getCredentials('homeboxApi');
	const raw = (credentials.baseUrl as string).trim().replace(/\/+$/, '');
	if (/\/api(\/v\d+)?$/i.test(raw)) {
		throw new NodeOperationError(
			this.getNode(),
			'The Homebox base URL must not include /api — use the root URL of your instance (e.g. https://homebox.example.com). The node appends /api/v1 itself.',
		);
	}
	return raw;
}

/**
 * Serialises query parameters by hand so array values become repeated keys
 * (tags=a&tags=b), which is what the Go backend expects. Undefined, null and
 * empty-string values are dropped.
 */
function buildQueryString(qs: IDataObject): string {
	const parts: string[] = [];
	for (const [key, value] of Object.entries(qs)) {
		if (value === undefined || value === null || value === '') continue;
		const values = Array.isArray(value) ? value : [value];
		for (const v of values) {
			if (v === undefined || v === null || v === '') continue;
			parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
		}
	}
	return parts.length ? `?${parts.join('&')}` : '';
}

export interface HomeboxRequestOptions {
	/** Raw pre-encoded request body (used for multipart uploads). */
	rawBody?: Buffer;
	/** Content-Type header when rawBody is set. */
	contentType?: string;
	/** Request binary data; resolves to { body: Buffer, headers } instead of JSON. */
	binary?: boolean;
	/** Expect a plain-text (non-JSON) response body, e.g. the CSV export. */
	text?: boolean;
}

/**
 * Single request wrapper: base URL joining, API key header, Accept header,
 * SSL toggle and error mapping all live here. There is no re-authentication
 * path because API keys are stateless.
 */
export async function homeboxApiRequest(
	this: HomeboxContext,
	method: IHttpRequestMethods,
	endpoint: string,
	body?: IDataObject,
	qs: IDataObject = {},
	options: HomeboxRequestOptions = {},
): Promise<unknown> {
	const credentials = await this.getCredentials('homeboxApi');
	const baseUrl = await getHomeboxBaseUrl.call(this);

	const requestOptions: IHttpRequestOptions = {
		method,
		url: `${baseUrl}/api/v1${endpoint}${buildQueryString(qs)}`,
		headers: {
			Accept: 'application/json',
		},
		skipSslCertificateValidation: credentials.ignoreSslIssues === true,
		json: !options.binary && !options.text,
	};

	if (options.rawBody !== undefined) {
		requestOptions.body = options.rawBody;
		requestOptions.headers!['Content-Type'] = options.contentType ?? 'application/octet-stream';
	} else if (body !== undefined) {
		requestOptions.body = body;
		requestOptions.headers!['Content-Type'] = 'application/json';
	}

	if (options.binary) {
		requestOptions.returnFullResponse = true;
		requestOptions.encoding = 'arraybuffer';
	}

	try {
		// The Authorization: Bearer <key> header is injected from the
		// credential's authenticate block.
		return await this.helpers.httpRequestWithAuthentication.call(
			this,
			'homeboxApi',
			requestOptions,
		);
	} catch (error) {
		throw mapHomeboxError.call(this, error as JsonObject, endpoint);
	}
}

function mapHomeboxError(this: HomeboxContext, error: JsonObject, endpoint: string): NodeApiError {
	const httpCode =
		(error.httpCode as string) ??
		((error.response as IDataObject)?.status !== undefined
			? String((error.response as IDataObject).status)
			: undefined);

	let message: string | undefined;
	let description: string | undefined;

	if (httpCode === '401' || httpCode === '403') {
		message = 'Homebox rejected the API key';
		description =
			'Check the API key is valid and has not been revoked. Keys are created in the Homebox user interface (Profile → API Keys); this package does not support username-and-password login.';
	} else if (httpCode === '404') {
		message = `Homebox returned 404 for ${endpoint}`;
		description =
			`If the resource ID is correct, your Homebox version may not serve this route: the API shape differs between the hay-kot and sysadminsmedia forks and across versions. This package targets ${TARGET_FORK}.`;
	}

	return new NodeApiError(this.getNode(), error, { message, description, httpCode });
}

/**
 * Paginates GET /entities. The list endpoint wraps results as
 * { items, total, page, pageSize, totalPrice }; this unwraps to the bare item
 * array. Archived entities are excluded by the server unless the caller sets
 * includeArchived=true in qs.
 */
export async function homeboxApiRequestAllItems(
	this: HomeboxContext,
	qs: IDataObject,
	returnAll: boolean,
	limit = 50,
): Promise<HomeboxEntitySummary[]> {
	const pageSize = returnAll ? 100 : Math.min(limit, 100);
	let page = 1;
	const results: HomeboxEntitySummary[] = [];

	for (;;) {
		const response = (await homeboxApiRequest.call(this, 'GET', '/entities', undefined, {
			...qs,
			page,
			pageSize,
		})) as HomeboxEntityListResult;

		const items = response.items ?? [];
		results.push(...items);

		const total = response.total ?? results.length;
		if (!returnAll && results.length >= limit) {
			return results.slice(0, limit);
		}
		if (items.length === 0 || results.length >= total) {
			return results;
		}
		page += 1;
	}
}

/**
 * Resolves the entity-type ID for items or locations. In this Homebox version
 * every entity has a type; the built-in types are global.item and
 * global.location, distinguished by the isLocation flag.
 */
export async function getEntityTypeId(
	this: HomeboxContext,
	isLocation: boolean,
): Promise<string | undefined> {
	const types = (await homeboxApiRequest.call(
		this,
		'GET',
		'/entity-types',
	)) as HomeboxEntityTypeSummary[];
	return types.find((t) => t.isLocation === isLocation)?.id;
}

/**
 * The Homebox date columns are nullable; a cleared date round-trips as a
 * 0001-xx-xx sentinel. Sending that back on PUT would re-set it, so normalise
 * sentinels to '' (which the server treats as "clear").
 */
export function normalizeHomeboxDate(value: string | undefined): string {
	if (!value || value.startsWith('0001-')) return '';
	return value;
}

/**
 * THE merge-on-update rule (docs/API.md finding 4, verified live):
 * PUT /entities/{id} is an unconditional full replace — omitted fields are
 * wiped, including tags and the parent location. Every update in this package
 * therefore reads the current entity, merges the requested changes on top,
 * and writes the complete payload back. Unspecified fields are preserved.
 */
export function buildEntityUpdatePayload(
	current: HomeboxEntityOut,
	changes: Partial<HomeboxEntityUpdatePayload>,
): HomeboxEntityUpdatePayload {
	const payload: HomeboxEntityUpdatePayload = {
		id: current.id,
		name: current.name,
		description: current.description ?? '',
		quantity: current.quantity ?? 0,
		archived: current.archived ?? false,
		insured: current.insured ?? false,
		assetId: current.assetId ?? '',
		serialNumber: current.serialNumber ?? '',
		modelNumber: current.modelNumber ?? '',
		manufacturer: current.manufacturer ?? '',
		notes: current.notes ?? '',
		purchaseFrom: current.purchaseFrom ?? '',
		purchasePrice: current.purchasePrice ?? 0,
		purchaseDate: normalizeHomeboxDate(current.purchaseDate),
		soldTo: current.soldTo ?? '',
		soldPrice: current.soldPrice ?? 0,
		soldDate: normalizeHomeboxDate(current.soldDate),
		soldNotes: current.soldNotes ?? '',
		lifetimeWarranty: current.lifetimeWarranty ?? false,
		warrantyExpires: normalizeHomeboxDate(current.warrantyExpires),
		warrantyDetails: current.warrantyDetails ?? '',
		syncChildEntityLocations: current.syncChildEntityLocations ?? false,
		parentId: current.parent?.id ?? null,
		entityTypeId: current.entityType?.id,
		tagIds: (current.tags ?? []).map((t) => t.id),
		fields: (current.fields ?? []) as HomeboxEntityFieldData[],
	};

	return { ...payload, ...changes };
}

export async function mergedEntityUpdate(
	this: HomeboxContext,
	entityId: string,
	changes: Partial<HomeboxEntityUpdatePayload>,
): Promise<HomeboxEntityOut> {
	const current = (await homeboxApiRequest.call(
		this,
		'GET',
		`/entities/${entityId}`,
	)) as HomeboxEntityOut;
	const payload = buildEntityUpdatePayload(current, changes);
	return (await homeboxApiRequest.call(
		this,
		'PUT',
		`/entities/${entityId}`,
		payload as unknown as IDataObject,
	)) as HomeboxEntityOut;
}

export interface MultipartField {
	fieldName: string;
	value?: string;
	buffer?: Buffer;
	filename?: string;
	contentType?: string;
}

/**
 * Hand-built multipart/form-data body (the package has zero runtime
 * dependencies, so no form-data library).
 */
export function buildMultipartBody(fields: MultipartField[]): {
	body: Buffer;
	contentType: string;
} {
	const boundary = `----n8nHomebox${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
	const chunks: Buffer[] = [];

	for (const field of fields) {
		let header = `--${boundary}\r\nContent-Disposition: form-data; name="${field.fieldName}"`;
		if (field.filename !== undefined) {
			header += `; filename="${field.filename.replace(/"/g, "'")}"`;
		}
		header += '\r\n';
		if (field.contentType) {
			header += `Content-Type: ${field.contentType}\r\n`;
		}
		header += '\r\n';
		chunks.push(Buffer.from(header, 'utf8'));
		chunks.push(field.buffer ?? Buffer.from(field.value ?? '', 'utf8'));
		chunks.push(Buffer.from('\r\n', 'utf8'));
	}
	chunks.push(Buffer.from(`--${boundary}--\r\n`, 'utf8'));

	return {
		body: Buffer.concat(chunks),
		contentType: `multipart/form-data; boundary=${boundary}`,
	};
}

/**
 * Minimal RFC-4180 CSV parser for the /entities/export payload (quoted fields,
 * embedded commas, quotes and newlines). Returns an array of rows.
 */
export function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let inQuotes = false;

	for (let i = 0; i < text.length; i++) {
		const char = text[i];
		if (inQuotes) {
			if (char === '"') {
				if (text[i + 1] === '"') {
					field += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				field += char;
			}
		} else if (char === '"') {
			inQuotes = true;
		} else if (char === ',') {
			row.push(field);
			field = '';
		} else if (char === '\n' || char === '\r') {
			if (char === '\r' && text[i + 1] === '\n') i++;
			row.push(field);
			field = '';
			if (row.length > 1 || row[0] !== '') rows.push(row);
			row = [];
		} else {
			field += char;
		}
	}
	if (field !== '' || row.length > 0) {
		row.push(field);
		if (row.length > 1 || row[0] !== '') rows.push(row);
	}
	return rows;
}

/**
 * Location dropdown options built from the tree endpoint so every entry shows
 * its full path (Garage → Shelf B → Bin 3) instead of just the leaf name.
 */
export async function getLocationPathOptions(
	this: HomeboxContext,
): Promise<INodePropertyOptions[]> {
	const tree = (await homeboxApiRequest.call(this, 'GET', '/entities/tree')) as HomeboxTreeItem[];
	const options: INodePropertyOptions[] = [];

	const walk = (nodes: HomeboxTreeItem[], path: string[]) => {
		for (const node of nodes) {
			if (node.type !== 'location') continue;
			const fullPath = [...path, node.name];
			options.push({ name: fullPath.join(' → '), value: node.id });
			if (node.children?.length) {
				walk(node.children, fullPath);
			}
		}
	};
	walk(tree, []);
	options.sort((a, b) => a.name.localeCompare(b.name));
	return options;
}

/**
 * Collects a location and all of its descendant location IDs from the tree —
 * used by the trigger's "new item in location" subtree scoping.
 */
export async function getLocationSubtreeIds(
	this: HomeboxContext,
	rootIds: string[],
): Promise<string[]> {
	const tree = (await homeboxApiRequest.call(this, 'GET', '/entities/tree')) as HomeboxTreeItem[];
	const ids = new Set<string>();

	const collect = (node: HomeboxTreeItem) => {
		if (node.type !== 'location') return;
		ids.add(node.id);
		for (const child of node.children ?? []) collect(child);
	};
	const walk = (nodes: HomeboxTreeItem[], withinSelection: boolean) => {
		for (const node of nodes) {
			if (node.type !== 'location') continue;
			if (withinSelection || rootIds.includes(node.id)) {
				collect(node);
			} else {
				walk(node.children ?? [], false);
			}
		}
	};
	walk(tree, false);
	return [...ids];
}

/**
 * Tag dropdown options. Tags nest via parentId, so entries show their parent
 * chain (Electronics / Cables) built client-side from the flat list.
 */
export async function getTagOptions(this: HomeboxContext): Promise<INodePropertyOptions[]> {
	const tags = (await homeboxApiRequest.call(this, 'GET', '/tags')) as HomeboxTagSummary[];
	const byId = new Map(tags.map((t) => [t.id, t]));
	const NIL = '00000000-0000-0000-0000-000000000000';

	const pathOf = (tag: HomeboxTagSummary): string => {
		const parts = [tag.name];
		let parentId = tag.parentId;
		let guard = 0;
		while (parentId && parentId !== NIL && guard++ < 20) {
			const parent = byId.get(parentId);
			if (!parent) break;
			parts.unshift(parent.name);
			parentId = parent.parentId;
		}
		return parts.join(' / ');
	};

	return tags
		.map((t) => ({ name: pathOf(t), value: t.id }))
		.sort((a, b) => a.name.localeCompare(b.name));
}
