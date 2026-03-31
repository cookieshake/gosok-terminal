// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
	site: 'https://cookieshake.github.io',
	base: '/gosok-terminal',
	integrations: [
		starlight({
			title: 'gosok',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/cookieshake/gosok-terminal' }],
			sidebar: [
				{
					label: 'Getting Started',
					items: [
						{ label: 'Introduction', slug: 'getting-started/introduction' },
						{ label: 'Installation', slug: 'getting-started/installation' },
						{ label: 'Quick Start', slug: 'getting-started/quick-start' },
					],
				},
				{
					label: 'Guides',
					items: [
						{ label: 'Projects & Tabs', slug: 'guides/projects-and-tabs' },
						{ label: 'Editor & Diff', slug: 'guides/editor-and-diff' },
						{ label: 'Notifications', slug: 'guides/notifications' },
						{ label: 'Agent Integration', slug: 'guides/agent-integration' },
					],
				},
				{
					label: 'CLI Reference',
					autogenerate: { directory: 'cli' },
				},
			],
		}),
	],
});
