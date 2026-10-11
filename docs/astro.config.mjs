import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://aletheia-works.github.io',
  base: '/terrarium',
  output: 'static',
  integrations: [
    starlight({
      title: 'terrarium',
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/aletheia-works/terrarium',
        },
      ],
      sidebar: [
        { label: 'Getting started', link: '/guides/getting-started/' },
        { label: 'Embedding', link: '/guides/embedding/' },
        { label: 'Source builds', link: '/guides/source-builds/' },
        { label: 'CLI consoles', link: '/demos/' },
        { label: 'Releases', link: '/guides/releases/' },
        { label: 'Architecture', link: '/reference/architecture/' },
        { label: 'Maintenance', link: '/reference/maintenance/' },
      ],
    }),
  ],
});
