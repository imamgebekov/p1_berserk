# Рисованные значки и музыка

Всё ниже — с [opengameart.org](https://opengameart.org), выбор владельца 2026-10-21. Файлы в игре сжаты (значки — WebP 128×128, музыка — MP3 112 кбит/с), содержание не менялось.

## Значки умений — `3d/src/art/spell/`

«Painterly Spell Icons», части 1–3 — J. W. Bjerk (eleazzaar), www.jwbjerk.com/art.
Лицензия: [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) (автор предлагает и другие: CC BY-SA, GPL).
- https://opengameart.org/content/painterly-spell-icons-part-1
- https://opengameart.org/content/painterly-spell-icons-part-2
- https://opengameart.org/content/painterly-spell-icons-part-3

Какое умение какой значок получает — `3d/src/data/spellart3d.js`.

## Музыка — `3d/music/`

| Файл | Трек | Автор | Лицензия | Источник |
|---|---|---|---|---|
| `intro.mp3` | Production Theme Intro [Epic Orchestra] | nene | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | https://opengameart.org/content/production-theme-intro-epic-orchestra |
| `boss_sunrise.mp3` | New Sunrise (V2) | nene | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | https://opengameart.org/content/new-sunrise |
| `roam_peractorum.mp3`, `roam_piano.mp3`, `roam_solitudine.mp3` | Emotional orchestral music (Peractorum, Piano Triste, Solitudine) | César da Rocha (cesisco) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | https://opengameart.org/content/emotional-orchestral-music |
| `roam_article169.mp3` | Article 169 Section 1 | Zander Noriega, César da Rocha (cesisco), TAD | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | https://opengameart.org/node/187536 |
| `sunset_plains.mp3` | Sunset Plains | Yoiyami | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | https://opengameart.org/content/sunset-plains |
| `another_august.mp3` | Another August (из саундтрека Pixelsphere) | The Cynic Project (cynicmusic.com, pixelsphere.org) | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | https://opengameart.org/content/another-august |
| `deja_vus.mp3` | Déjà Vus (Contemplative Fantasy Music Pack) | YannZ (Yanni Ziangos), yannz41.itch.io | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | https://opengameart.org/content/free-contemplative-fantasy-music-pack |
| `staldorn_suite.mp3` | Staldorn Suite — «Music: Staldorn Suite by Shane Ivers - https://www.silvermansound.com» | Shane Ivers | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | https://www.silvermansound.com/free-music/staldorn-suite |

Музыка по местам (2026-10-27, выбор владельца): треки и места — `config3d.js` → `audio.tracks.places`. Файлы переведены в MP3 (112 кбит/с, «Déjà Vus» — 80), громкость выровнена, содержание не менялось.

## Звуки — `3d/sfx/`

Выбор владельца 2026-10-25. Все — CC0 (общественное достояние), указывать авторов не обязательно — указываем из уважения. Файлы сжаты в моно MP3 64 кбит/с, громкость выровнена, у петель сглажен стык (`tools/make-sfx.py`); содержание не менялось.

| Файлы | Что | Автор | Источник |
|---|---|---|---|
| `loop_birds.mp3` | Birds and Wind — Ambient (птицы: isaiah658, syncopika, pauliuw, общественное достояние) | Spring Spring | https://opengameart.org/content/birds-and-wind-ambient-birds-wind-and-synth |
| `loop_crickets.mp3` | Crickets Ambient Noise — loopable | Wolfgang_ (Ted Kerr) | https://opengameart.org/content/crickets-ambient-noise-loopable |
| `loop_rain.mp3`, `thunder.mp3` | Rain + Long Thunder | WuxiaScrub | https://opengameart.org/content/rain-long-thunder |
| `loop_river.mp3` | Sea and river wave sounds (Висла) | RandomMind | https://opengameart.org/content/sea-and-river-wave-sounds |
| `loop_fire.mp3` | Fireplace Sound loop | PagDev | https://opengameart.org/content/fireplace-sound-loop |
| `crow.mp3` | Crow caw | zeroisnotnull | https://opengameart.org/content/crow-caw |
| `wings.mp3` | Large Wings Flap (из «fast simple chop 5» — dave.des, Freesound, CC0) | AntumDeluge | https://opengameart.org/content/large-wings-flap |
| `anvil.mp3` | Hammer on Anvil (из «Hammer and anvil» — Duasun, Freesound, CC0) | themightyglider | https://opengameart.org/node/108999 |
| `step_*.mp3` | Impact Sounds (шаги: трава, камень, дерево, песок — из grass, concrete, wood, snow) | Kenney | https://kenney.nl/assets/impact-sounds |
| `coins_*`, `book_*`, `cloth_*`, `belt_*`, `creak_*`, `latch`, `leather` | RPG Audio | Kenney | https://kenney.nl/assets/rpg-audio |
