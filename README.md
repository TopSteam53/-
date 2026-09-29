# «С нуля до результата» — пайплайн TikTok-видео

Программная сборка вертикальных роликов 1080×1920 / 30 fps / H.264: озвучка → субтитры по словам → моушн-графика → музыка и SFX → mp4.
Всё работает офлайн и без платных API.

| Что | Чем |
|---|---|
| Озвучка | Piper (нейросетевой VITS), голос `ru_RU-denis` (датасет CC0), отбор лучшего дубля по ASR |
| Тайминги слов | GigaAM v2 (sherpa-onnx) + выравнивание по символам |
| Монтаж и графика | Remotion 4 (React), шрифты Unbounded / Montserrat / JetBrains Mono (OFL) |
| Музыка и SFX | синтезированы кодом (`pipeline/audio/`) — никаких сэмплов, 0 рисков Content ID |
| Сведение | numpy: EQ/компрессия голоса, sidechain-приглушение музыки, лимитер, −14 LUFS |

## Быстрый старт

```bash
bash pipeline/setup.sh                                  # один раз: зависимости + модели (~450 МБ)
python pipeline/make_episode.py episodes/ep01           # -> output/video_01.mp4
python pipeline/make_episode.py episodes/ep01 --draft   # быстрый черновик в половинном разрешении
```

## Новое видео

1. **Записи.** Положи клипы в `footage/` с понятными именами, например `footage/moderation_screen.mp4`, `footage/gameplay_main.mp4`.
   Подходит любой формат и ориентация: пайплайн сам приведёт клип к 9:16 и 30 fps, а края заполнит размытой копией.
   Интерфейс телефона или браузера обрезается через `"footage": {"<клип>": {"crop": "w:h:x:y"}}` в `episode.json`.
   Для ep01 это `footage/murmerge_play.mp4` с `crop 680:1167:20:168` (без панели Яндекса и рекламного баннера).
2. **Эпизод.** Скопируй `episodes/ep01` → `episodes/ep02`, поменяй `id`, `episodeNumber` и `lines`.
3. **Рендер.** `python pipeline/make_episode.py episodes/ep02` → `output/video_02.mp4`.

### Формат `episode.json`

```jsonc
{
  "voice": { "engine": "piper:denis", "speed": 1.13, "takes": 8 },   // или "rhvoice:artemiy", "piper:dmitri"
  "music": { "bpm": 124, "seed": 7, "lufs": -21, "duckDb": -8,
             "cues": { "break": ["zero", 5], "build": ["goal", 4], "drop": ["cta", 0] } }, // [id строки, № слова]
  "lines": [
    {
      "id": "hook",
      "say": "Эту игру написала нейросеть.",        // что произносит голос
      "sub": "Эту игру написала нейросеть.",        // (опц.) что в субтитрах — столько же слов
      "emphasis": [3],                              // № слов, подсвеченных розовым
      "shots": [                                    // смена плана привязана к № слова
        { "w": 0, "type": "gameplay", "props": { "clip": "gameplay_main", "from": 6, "zoom": [1.35, 1.15] },
          "fx": ["flash", "punch"], "sfx": ["boom"] },
        { "w": 3, "type": "aichat", "props": { "mode": "coding" }, "fx": ["whip"], "sfx": ["whoosh_1"] }
      ],
      "sfx": [{ "w": 2, "name": "pop" }]
    }
  ]
}
```

**Произношение.**
- Ударение ставится знаком `´` после гласной: `черно́вике`.
- Для новых слов можно подать фонемы espeak: `[[ murːmʲˈerʃ ]]`, а в `sub` написать «Мурмерж».
- Если ASR слышит в дубле что-то похожее на мат, такой дубль отбрасывается автоматически.
- Несколько произносимых слов, которые в субтитрах идут одним словом, склеиваются через `_`: `Чат_Джи_Пи_Ти` ↔ `ChatGPT`.

**Типы планов** (`remotion/src/shots/`):

| Тип | Что показывает | Параметры |
|---|---|---|
| `gameplay` | запись игры | `clip`, `from` (секунда исходника), `zoom:[a,b]`, `focus:[x,y]` (наезд на точку, 0..1), `target`, `rate` (скорость), `dim`, `sparkles`, `hearts` |
| `aichat` | чат с нейросетью | `mode`: `coding` / `angry` / `fixagain`, `variant` |
| `code` | редактор кода | `mode`: `typing` / `copypaste`, `variant` |
| `crossout` | зачёркнутые слова | `items`, `flyaway` |
| `party` | RPG-карточки команды | `reveal:[№слова…]` |
| `title` | титр | `kind`: `series` / `game` |
| `upload` | загрузка билда | — |
| `status` | статус игры в консоли | `status` |
| `roadmap` | дорожная карта | `lightOn:[[№слова, №узла]…]`, `continue` |
| `money` | деньги | `mode`: `question` / `zero` / `chart` |
| `bug` | запись с ошибками | — |
| `subscribe` | призыв подписаться | — |
| `teaser` | анонс следующего эпизода | `episode`, `title` |
| `verdict` | вердикт | — |
| `tg` | карточка Telegram-канала | `title`, `items` |
| `phone` | 3D-мокап телефона с клипом на экране | `clip`, `from`, `rotY:[a,b]`, `coins`, `tap:{x,y,w}`, `label`, `bg` |
| `coins` | дождь из 3D-монет (можно поверх размытого клипа) | `clip`, `from`, `text`, `size`, `n` |
| `big` | огромное слово с иконкой | `icon`, `text`, `sub` |
| `list` | карточки, появляющиеся по словам | `title`, `items:[{icon,t,s,w,hi}]` (`w:-1` — уже показан) |
| `flow` | схема «откуда деньги» с летящими монетами | `nodes:[{icon,t,w}]` |
| `formula` | формула из множителей | `terms:[{icon,t,w}]`, `resultW` |

Для `gameplay` доступны ещё `magnify:{at:[x,y],zoom,r,pos:[px,py]}` (лупа) и `badge` (плашка «ЭПИЗОД 1»).
Весь b-roll генерируется кодом, внешние стоки не нужны. Если откроешь доступ к Pexels или Pixabay в сетевых настройках
окружения или положишь свои клипы в `footage/`, их можно ставить в любой `gameplay`/`phone`/`coins` через `clip`.

**Эффекты переходов** (`fx`): `punch`, `whip`, `flash`, `shake`, `glitch`. На `boom` камера трясётся автоматически.
**SFX:** `assets/sfx/index.json` (вжухи, бум, клик, поп, дзинь, ошибка, глитч, грустный тромбон, скретч, райзер и др.).

## Проверка качества

- `node remotion/render.mjs build/ep01/timeline.json x.mp4 --stills=0,90,300 --stills-dir=/tmp/stills --scale=0.5` — стоп-кадры.
- `build/<ep>/timeline.json` — поле `asr` у каждой строки показывает, как распознаётся озвучка (ловит плохие ударения).
- Безопасная зона TikTok: субтитры центрированы на y≈1235, контент — между y 250 и 1130, правый край ≤ 990 px.

## Структура

```
episodes/<ep>/episode.json   сценарий + раскадровка
episodes/<ep>/script.md      человекочитаемый сценарий, варианты хуков
footage/                     твои записи
pipeline/                    tts, asr, build_timeline, mix, make_episode, audio/
remotion/                    React-композиция
assets/music, assets/sfx     сгенерированные звуки
output/                      готовые видео и post.md
```
