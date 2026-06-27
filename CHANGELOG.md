# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [0.1.4](https://github.com/gustavo-praxedes/obsidian-cascade/compare/v0.1.3...v0.1.4) (2026-06-27)


### Features

* [/] processavel e preservado no destino da migracao ([c161429](https://github.com/gustavo-praxedes/obsidian-cascade/commit/c16142921c7e17e94f9c2461e8325c02419d1ff0)), closes [#2](https://github.com/gustavo-praxedes/obsidian-cascade/issues/2) [#3](https://github.com/gustavo-praxedes/obsidian-cascade/issues/3) [#2](https://github.com/gustavo-praxedes/obsidian-cascade/issues/2) [#3](https://github.com/gustavo-praxedes/obsidian-cascade/issues/3)
* Adicionado primeira em maiuscula ao normalize ([5b17881](https://github.com/gustavo-praxedes/obsidian-cascade/commit/5b178817c9f41eb4832e5b454312cc024ae0b8f0))
* align default settings and UI structure ([9a88d0d](https://github.com/gustavo-praxedes/obsidian-cascade/commit/9a88d0d604038cc6a90d8fad940ae4499ae073b0))
* **calendar:** i18n, week numbers, openInNewLeaf, confirmCreate, performance, DRY toggle, tests ([2daf051](https://github.com/gustavo-praxedes/obsidian-cascade/commit/2daf0517aea94d19b0230066e36d8d611f4f3e09))
* config de abertura de notas por periodo ao iniciar (Divergencia [#10](https://github.com/gustavo-praxedes/obsidian-cascade/issues/10)) ([884b628](https://github.com/gustavo-praxedes/obsidian-cascade/commit/884b6288f40db050695e25c7bf7065699f17b854))
* **config:** startup delay before migration (divergence [#9](https://github.com/gustavo-praxedes/obsidian-cascade/issues/9)) ([1c93efd](https://github.com/gustavo-praxedes/obsidian-cascade/commit/1c93efd8ebfbe3d37ffff1cea247fb1a4cfca150))
* **frontmatter:** fix bugs, improve format tokenizer, dispose cleanup, initializeAll, 13 tests ([9c1c307](https://github.com/gustavo-praxedes/obsidian-cascade/commit/9c1c307a7eebad39e3c6289a5559f4bb6a400ec4))
* **i18n:** full internationalization of settings tab and all UI strings ([3406269](https://github.com/gustavo-praxedes/obsidian-cascade/commit/3406269e1d920083a2d4a431cc58a3e329a772c4))
* implement log interno com categorias configuraveis ([c5c1702](https://github.com/gustavo-praxedes/obsidian-cascade/commit/c5c170219bc4d837b5868348f67987cc275a188d))
* implement marcadores 🔜/🔚 na migração em cascata ([18a5e66](https://github.com/gustavo-praxedes/obsidian-cascade/commit/18a5e6611955279556c448cf0c8bea1be8e8798e))
* **migration:** cascade skipping when log levels are disabled ([5d97a79](https://github.com/gustavo-praxedes/obsidian-cascade/commit/5d97a790a121d4c9ee0cf1575148a62ee01c87b9))
* **normalizer:** fix 4 bugs, add 5 case modes, normalize-now command, 28 tests ([e164968](https://github.com/gustavo-praxedes/obsidian-cascade/commit/e1649683a223da9af3eb5b62ae20ec5c87ef9fbd))
* processa periodos perdidos - dias, semanas e meses (Divergencia [#5](https://github.com/gustavo-praxedes/obsidian-cascade/issues/5)) ([e18c827](https://github.com/gustavo-praxedes/obsidian-cascade/commit/e18c8270ebd74152434cd8fb247719f4c44f7a88))
* **settings:** all enable/disable toggles in General, nav tabs hide when feature disabled ([5e5ba76](https://github.com/gustavo-praxedes/obsidian-cascade/commit/5e5ba761a1e8466e3f6758ca2af132bf06b8a909))
* **settings:** consolidate open-on-startup toggles into dropdown above agendaRoot ([42e3868](https://github.com/gustavo-praxedes/obsidian-cascade/commit/42e3868b24337301505377ccdfc8cfcdd35ad037))
* **settings:** redesign moderado - cards, busca, tooltips, nav tabs, import/export, reset ([65c967e](https://github.com/gustavo-praxedes/obsidian-cascade/commit/65c967e63dbcf1bcf8c4157a72d25cb378182a2b))
* submenus indentados e padronizacao do settings UI ([8c7165f](https://github.com/gustavo-praxedes/obsidian-cascade/commit/8c7165fa4552ee977f50ffc746ba1c1176ec1c72))
* **tasks:** explicit ⏰ time marker preservation in migration pipeline ([21cc198](https://github.com/gustavo-praxedes/obsidian-cascade/commit/21cc1988b5ad9d95b7eb3d473f362d4d953d24ec))


### Bug Fixes

* Ajuste do bug na recriação de notas diarias acentuadas ([005f5e1](https://github.com/gustavo-praxedes/obsidian-cascade/commit/005f5e1d3b78b4652ad39edb1491022fcbe4cf5b))
* align startup delay with spec (issue [#9](https://github.com/gustavo-praxedes/obsidian-cascade/issues/9)) ([06dc10c](https://github.com/gustavo-praxedes/obsidian-cascade/commit/06dc10cf895c3bdea2f75ed74adb07382bae2b42))
* cascade migration guards + repair service for weekly-enabled monthly files ([c37cfff](https://github.com/gustavo-praxedes/obsidian-cascade/commit/c37cfff2b1c6b218813b9ac17f5ac574a20223fe))
* Correção de caminhas na agenda ([182ca15](https://github.com/gustavo-praxedes/obsidian-cascade/commit/182ca155129991cb91d1475cbc17b73f21a92c1d))
* corrige 9 testes pre-existentes (stripMarker, reconcileTaskFamilies, path expectations) ([b4b5691](https://github.com/gustavo-praxedes/obsidian-cascade/commit/b4b56915240c799ff944bd80270df7cfca3749e0))
* position cursor at end of upper log after reschedule (divergence [#8](https://github.com/gustavo-praxedes/obsidian-cascade/issues/8)) ([49515b8](https://github.com/gustavo-praxedes/obsidian-cascade/commit/49515b8f4f8993a200ec98ff9cc1d43f2d57f789))
* preserve [/] status in forwardable migration (issue [#3](https://github.com/gustavo-praxedes/obsidian-cascade/issues/3)) ([8bc94f6](https://github.com/gustavo-praxedes/obsidian-cascade/commit/8bc94f663b471a31b6e95feb1a6145f44135f1d7))
* preserve ⏰ time marker on child tasks in forwardable migration (issue [#7](https://github.com/gustavo-praxedes/obsidian-cascade/issues/7)) ([dbf0cc8](https://github.com/gustavo-praxedes/obsidian-cascade/commit/dbf0cc85f121bcb56232ff3fc875f80234b9b8a4))
* preserve 🔚/🔜 markers through migration cascade ([f7d3535](https://github.com/gustavo-praxedes/obsidian-cascade/commit/f7d3535a11e99a023d14fcccf2e58d9972f2f84c))
* prevent completed tasks from reappearing after Obsidian restart ([9905268](https://github.com/gustavo-praxedes/obsidian-cascade/commit/99052684d4f83bf1dd362831c4d822e5f4552482))
* recurring tasks follow cascade (issue [#6](https://github.com/gustavo-praxedes/obsidian-cascade/issues/6)) ([1b7ffba](https://github.com/gustavo-praxedes/obsidian-cascade/commit/1b7ffbabd1f3d93457c50c9a56a4b6962822b02d))
* rescheduling preserves state and positions cursor (issue [#8](https://github.com/gustavo-praxedes/obsidian-cascade/issues/8)) ([433bd78](https://github.com/gustavo-praxedes/obsidian-cascade/commit/433bd7874a154bbe56f643a85fbf35a1da7307e4))
* **settings:** prevent duplicate nav menus on section click ([20c020c](https://github.com/gustavo-praxedes/obsidian-cascade/commit/20c020c8a97a29c5e6659c037c9ec8fc124b384f))
* **settings:** single-select dropdown for open-on-startup, default Daily ([e17779c](https://github.com/gustavo-praxedes/obsidian-cascade/commit/e17779c3382ad85c7cd41e8c5faa552d464dfc22))

## [0.1.3](https://github.com/gustavo-praxedes/obsidian-cascade/compare/v0.1.2...v0.1.3) (2026-06-16)

## [0.1.2](https://github.com/gustavo-praxedes/obsidian-cascade/compare/v0.1.1...v0.1.2) (2026-06-16)


### Features

* implement week ([e120581](https://github.com/gustavo-praxedes/obsidian-cascade/commit/e120581b70127366020530400a7bac35a60babc9))


### Bug Fixes

* carry in-progress child tasks from previous days ([1e5b536](https://github.com/gustavo-praxedes/obsidian-cascade/commit/1e5b53628d74a3609ccf9320fb9e4df73dec11ef))

## [0.1.1](https://github.com/gustavo-praxedes/obsidian-cascade/compare/v0.1.0...v0.1.1) (2026-06-15)

## 0.1.0 (2026-06-15)


### Features

* implement initial Cascade plugin e9d567e
* implement task enhancements and fix checkbox snippet rendering c64f284
