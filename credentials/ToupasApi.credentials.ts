import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class ToupasApi implements ICredentialType {
	name = 'toupasApi';

	displayName = 'Toupas API';

	icon: Icon = { light: 'file:toupas.svg', dark: 'file:toupas.dark.svg' };

	documentationUrl = 'https://github.com/shmshrivastava/n8n-nodes-toupas#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			description:
				'Make one in the Toupas panel under Keys (app.toupas.com). It starts with tps_.',
		},
		{
			displayName: 'Toupas Address',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.toupas.com',
			description: 'Leave this as it is unless Toupas asks you to change it',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}/v1',
			url: '/websites',
			method: 'GET',
			headers: { 'Toupas-Client': 'n8n' },
		},
	};
}
