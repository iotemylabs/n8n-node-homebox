import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class HomeboxApi implements ICredentialType {
	name = 'homeboxApi';

	displayName = 'Homebox API';

	icon: Icon = {
		light: 'file:../nodes/Homebox/homebox.svg',
		dark: 'file:../nodes/Homebox/homebox.dark.svg',
	};

	documentationUrl = 'https://github.com/iotemylabs/n8n-node-homebox#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: '',
			placeholder: 'https://homebox.example.com',
			description:
				'The root URL of your Homebox instance, without a trailing /api. Trailing slashes are stripped automatically.',
			required: true,
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description:
				'A Homebox API key (starts with "hb_"), created in the Homebox UI under Profile → API Keys. The key grants the same access as the account that created it — Homebox keys are not scoped. This package deliberately does not support username-and-password login.',
			required: true,
		},
		{
			displayName: 'Ignore SSL Issues (Insecure)',
			name: 'ignoreSslIssues',
			type: 'boolean',
			default: false,
			description: 'Whether to connect even if SSL certificate validation fails, e.g. for self-signed certificates',
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
			baseURL: '={{$credentials.baseUrl.replace(/\\/+$/, "")}}',
			url: '/api/v1/users/self',
			method: 'GET',
			skipSslCertificateValidation: '={{$credentials.ignoreSslIssues}}' as unknown as boolean,
		},
	};
}
