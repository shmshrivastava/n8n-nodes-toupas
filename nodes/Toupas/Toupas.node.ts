import type {
	IDataObject,
	JsonObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { binaryFiles, toupasRequest, type ToupasFile } from './GenericFunctions';

const publishShown = { resource: ['website', 'app'], operation: ['publish'] };

const filesFields: INodeProperties[] = [
	{
		displayName: 'Files From',
		name: 'source',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: publishShown },
		options: [
			{
				name: 'HTML Field',
				value: 'html',
				description: 'One page, written here or by an earlier step (for example an AI model)',
			},
			{
				name: 'Input Files',
				value: 'binary',
				description: 'Files from earlier steps: pages, styles, scripts, images',
			},
		],
		default: 'html',
	},
	{
		displayName: 'Page HTML',
		name: 'html',
		type: 'string',
		typeOptions: { rows: 8 },
		required: true,
		displayOptions: { show: { ...publishShown, source: ['html'] } },
		default: '',
		placeholder: '<!doctype html><title>Hello</title><h1>Hello</h1>',
		description: 'The whole page. It becomes index.html, the page the link opens.',
	},
	{
		displayName: 'Input File Fields',
		name: 'binaryFields',
		type: 'string',
		required: true,
		displayOptions: { show: { ...publishShown, source: ['binary'] } },
		default: 'data',
		description:
			'The fields of this item that hold files, separated by commas. Each file keeps its name, so one must be index.html.',
	},
];

const websiteRef = (resource: 'website' | 'app'): INodeProperties => ({
	displayName: resource === 'app' ? 'App' : 'Website',
	name: 'ref',
	type: 'string',
	required: true,
	displayOptions: { show: { resource: [resource], operation: ['get'] } },
	default: '',
	placeholder: resource === 'app' ? 'Party RSVP' : 'Weekly report',
	description: 'Its name, link or ID',
});

export class Toupas implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Toupas',
		name: 'toupas',
		icon: { light: 'file:toupas.svg', dark: 'file:toupas.dark.svg' },
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Put websites and apps with saved data live at a link anyone can open',
		defaults: { name: 'Toupas' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'toupasApi', required: true }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Website',
						value: 'website',
						description: 'Pages anyone can open, with nothing saved',
					},
					{
						name: 'App',
						value: 'app',
						description: 'Pages that save data, with sign-in and access rules',
					},
				],
				default: 'website',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['website'] } },
				options: [
					{
						name: 'Get',
						value: 'get',
						description: 'Get a website’s link and whether it’s live',
						action: 'Get a website',
					},
					{
						name: 'Get Many',
						value: 'getAll',
						description: 'Get the websites and apps in this account',
						action: 'Get many websites',
					},
					{
						name: 'Publish',
						value: 'publish',
						description: 'Put a website live, or update the one with the same name',
						action: 'Publish a website',
					},
				],
				default: 'publish',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['app'] } },
				options: [
					{
						name: 'Get',
						value: 'get',
						description: 'Get an app’s link and whether it’s live',
						action: 'Get an app',
					},
					{
						name: 'Publish',
						value: 'publish',
						description: 'Put an app live, or update the one with the same name',
						action: 'Publish an app',
					},
				],
				default: 'publish',
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				required: true,
				displayOptions: { show: publishShown },
				default: '',
				placeholder: 'Weekly report',
				description:
					'A short name. If one with this name already exists in your account, it’s updated and keeps its link.',
			},
			...filesFields,
			{
				displayName: 'Data Description (JSON)',
				name: 'data',
				type: 'json',
				displayOptions: { show: { resource: ['app'], operation: ['publish'] } },
				default: '',
				description:
					'What the app saves and who can do what. Needed for a new app; leave empty to keep the current one when only the pages change. See the README for the format.',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				displayOptions: { show: publishShown },
				default: {},
				options: [
					{
						displayName: 'Remove Files Not Sent',
						name: 'replace',
						type: 'boolean',
						default: false,
						description:
							'Whether the files sent become the whole site. Off: files already live that aren’t sent stay.',
					},
				],
			},
			websiteRef('website'),
			websiteRef('app'),
			{
				displayName: 'Return All',
				name: 'returnAll',
				type: 'boolean',
				displayOptions: { show: { resource: ['website'], operation: ['getAll'] } },
				default: false,
				description: 'Whether to return all results or only up to a given limit',
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				typeOptions: { minValue: 1 },
				displayOptions: {
					show: { resource: ['website'], operation: ['getAll'], returnAll: [false] },
				},
				default: 50,
				description: 'Max number of results to return',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as 'website' | 'app';
				const operation = this.getNodeParameter('operation', i) as string;

				if (operation === 'publish') {
					const name = (this.getNodeParameter('name', i) as string).trim();
					const source = this.getNodeParameter('source', i) as 'html' | 'binary';
					const options = this.getNodeParameter('options', i, {}) as { replace?: boolean };
					const files: ToupasFile[] =
						source === 'html'
							? [{ path: 'index.html', content: this.getNodeParameter('html', i) as string }]
							: await binaryFiles.call(this, i, this.getNodeParameter('binaryFields', i) as string);
					const args: IDataObject = { name, files };
					if (options.replace) args.mode = 'replace';
					if (resource === 'app') {
						const data = this.getNodeParameter('data', i, '') as string | IDataObject;
						if (typeof data === 'string' && data.trim()) {
							try {
								args.data = JSON.parse(data) as IDataObject;
							} catch {
								throw new NodeOperationError(this.getNode(), 'The data description isn’t valid JSON', {
									itemIndex: i,
								});
							}
						} else if (data && typeof data === 'object') {
							args.data = data;
						}
					}
					const result = await toupasRequest.call(
						this,
						'POST',
						resource === 'app' ? '/apps/publish' : '/websites/publish',
						i,
						args,
					);
					returnData.push({ json: result, pairedItem: { item: i } });
				} else if (operation === 'get') {
					const ref = (this.getNodeParameter('ref', i) as string).trim();
					const result = await toupasRequest.call(
						this,
						'GET',
						`/websites/${encodeURIComponent(ref)}`,
						i,
					);
					returnData.push({ json: result, pairedItem: { item: i } });
				} else if (operation === 'getAll') {
					const result = await toupasRequest.call(this, 'GET', '/websites', i);
					let sites = (result.websites as IDataObject[] | undefined) ?? [];
					if (!(this.getNodeParameter('returnAll', i) as boolean)) {
						sites = sites.slice(0, this.getNodeParameter('limit', i) as number);
					}
					returnData.push(...sites.map((json) => ({ json, pairedItem: { item: i } })));
				} else {
					throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`, {
						itemIndex: i,
					});
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				if (error instanceof NodeApiError) {
					throw new NodeApiError(this.getNode(), error as unknown as JsonObject, {
						itemIndex: i,
						message: error.message,
						description: error.description ?? undefined,
					});
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
