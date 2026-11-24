import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

/** A file as Toupas takes it: text as it is, anything else as base64. */
export type ToupasFile = { path: string; content: string; encoding?: 'utf8' | 'base64' };

type ToupasErrorBody = { code?: string; message?: string; hint?: string };

/**
 * Calls Toupas's REST API (`<address>/v1/...`) with the key from the credential. Answers carry a
 * `message` in plain words; refusals carry `code`, `message` and sometimes a `hint`.
 */
export async function toupasRequest(
	this: IExecuteFunctions,
	method: IHttpRequestMethods,
	path: string,
	itemIndex: number,
	body?: IDataObject,
): Promise<IDataObject> {
	const credentials = await this.getCredentials('toupasApi');
	const baseUrl = String(credentials.baseUrl || 'https://api.toupas.com').replace(/\/+$/, '');
	const options: IHttpRequestOptions = {
		method,
		url: `${baseUrl}/v1${path}`,
		headers: { 'Toupas-Client': 'n8n' },
		json: true,
	};
	if (body) options.body = body;

	try {
		return (await this.helpers.httpRequestWithAuthentication.call(
			this,
			'toupasApi',
			options,
		)) as IDataObject;
	} catch (error) {
		const response = (error as { response?: { status?: number; data?: ToupasErrorBody } })
			.response;
		const data = response?.data;
		if (response?.status === 401) {
			throw new NodeApiError(this.getNode(), error as JsonObject, {
				itemIndex,
				message: 'Toupas didn’t accept the key',
				description:
					'Check the key in the Toupas credential. It may have been removed in the Toupas panel, or ended after 90 days unused.',
			});
		}
		if (data?.message) {
			throw new NodeApiError(this.getNode(), error as JsonObject, {
				itemIndex,
				message: data.message,
				description: data.hint,
				httpCode: String(response?.status ?? ''),
			});
		}
		throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex });
	}
}

const TEXT_TYPES = [
	'application/javascript',
	'application/json',
	'application/xml',
	'image/svg+xml',
	'application/manifest+json',
];
const TEXT_EXTENSIONS = /\.(html?|css|m?js|json|svg|txt|xml|md|webmanifest|map)$/i;

/** Files from earlier steps: text as it is, everything else (images, fonts) as base64. */
export async function binaryFiles(
	this: IExecuteFunctions,
	itemIndex: number,
	fieldNames: string,
): Promise<ToupasFile[]> {
	const item = this.getInputData()[itemIndex];
	const names = fieldNames
		.split(',')
		.map((field) => field.trim())
		.filter(Boolean);
	const files: ToupasFile[] = [];
	for (const field of names) {
		const binary = item.binary?.[field];
		if (!binary) {
			throw new NodeOperationError(
				this.getNode(),
				`There's no file in the field "${field}" of this item`,
				{ itemIndex, description: 'Check the Input File Fields setting.' },
			);
		}
		if (!binary.fileName) {
			throw new NodeOperationError(this.getNode(), `The file in "${field}" has no name`, {
				itemIndex,
				description: 'Give each file a name, such as index.html or style.css.',
			});
		}
		const path = (binary.directory ? `${binary.directory}/` : '') + binary.fileName;
		const buffer = await this.helpers.getBinaryDataBuffer(itemIndex, field);
		const mime = binary.mimeType ?? '';
		const text =
			mime.startsWith('text/') || TEXT_TYPES.includes(mime) || TEXT_EXTENSIONS.test(path);
		files.push(
			text
				? { path, content: buffer.toString('utf8') }
				: { path, content: buffer.toString('base64'), encoding: 'base64' },
		);
	}
	return files;
}
