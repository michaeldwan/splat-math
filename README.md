# Splat Math

Low-stress multiplication practice for kids. A round is timed, but no clock shows
while you play. The score appears when the round ends, along with the problems you
missed. Every right answer splats the wall with ink. Try and cover it.

Play it at [splatmath.com](https://splatmath.com).

The default round is 2:30 with a goal of 50 right answers, and covers the 2-9
times tables. Settings changes the round length, the goal, which tables come up
(0-12), and sound. Scores and settings are saved in the browser's local storage.

## Development

Built with [Astro](https://astro.build) and React, and deployed to
[Cloudflare Workers](https://www.cloudflare.com/products/workers/).
Tools are managed with [mise](https://mise.jdx.dev):

```sh
mise install
mise run dev     # dev server
mise run check   # formatting, lint, typecheck, and tests
mise run deploy  # checks, build, then deploy
```

GitHub Actions runs `mise run check` on every push and pull request. Pushes to
`main` deploy to production.

## License

[MIT](LICENSE)
