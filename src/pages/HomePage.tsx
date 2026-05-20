import { Link } from 'react-router-dom'

export default function HomePage() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">РўСЂРµРЅР°Р¶С‘СЂ Р°С‚С‚РµСЃС‚Р°С†РёРё</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
          Р‘Р°Р·Р°: <span className="font-semibold text-zinc-800 dark:text-zinc-100">~100 РІРѕРїСЂРѕСЃРѕРІ РїРѕ РѕСЃРЅРѕРІР°Рј РРў</span> Рё{' '}
          <span className="font-semibold text-zinc-800 dark:text-zinc-100">123 РІРѕРїСЂРѕСЃР° РїРѕ Р’РќР”</span> (10 С‚РµРј). Р’ СЌРєР·Р°РјРµРЅРµ Рё
          СЃРјРµС€Р°РЅРЅРѕР№ С‚СЂРµРЅРёСЂРѕРІРєРµ СЃРѕР±Р»СЋРґР°РµС‚СЃСЏ РїСЂРѕРїРѕСЂС†РёСЏ: РїСЂРёРјРµСЂРЅРѕ <span className="font-semibold">в…“ Р’РќР” + в…” РРў</span> (РґР»СЏ 15
          РІРѕРїСЂРѕСЃРѕРІ вЂ” 5 Рё 10).
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-700 dark:bg-zinc-950/50">
            <div className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">РўСЂРµРЅРёСЂРѕРІРєР°</div>
            <div className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">РЎ РїРѕРґСЃРєР°Р·РєР°РјРё</div>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              Р’С‹Р±РµСЂРёС‚Рµ С‚РµРјСѓ Р’РќР” РёР»Рё СЃРјРµС€Р°РЅРЅС‹Р№ СЂРµР¶РёРј. РџРѕСЃР»Рµ РѕС‚РІРµС‚Р° вЂ” РїСЂР°РІРёР»СЊРЅС‹Р№ РІР°СЂРёР°РЅС‚ Рё РїРѕСЏСЃРЅРµРЅРёРµ.
            </p>
            <Link
              to="/training"
              className="mt-4 inline-flex w-full justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              РќР°С‡Р°С‚СЊ С‚СЂРµРЅРёСЂРѕРІРєСѓ
            </Link>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-700 dark:bg-zinc-950/50">
            <div className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">Р­РєР·Р°РјРµРЅ</div>
            <div className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">РўР°Р№РјРµСЂ Рё РѕС‚С‡С‘С‚</div>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              РЎРјРµС€Р°РЅРЅС‹Р№ С‚РµСЃС‚ (Р’РќР” + РРў), СЂРµР·СѓР»СЊС‚Р°С‚ СЃРѕС…СЂР°РЅСЏРµС‚СЃСЏ РІ Р±Р°Р·Сѓ. РџСЂРѕС…РѕРґРЅРѕР№ Р±Р°Р»Р» вЂ” 70%.
            </p>
            <Link
              to="/exam"
              className="mt-4 inline-flex w-full justify-center rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
            >
              РќР°С‡Р°С‚СЊ СЌРєР·Р°РјРµРЅ
            </Link>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">РђРґРјРёРЅ-РїР°РЅРµР»СЊ</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          РЎС‚Р°С‚РёСЃС‚РёРєР° РїРѕРїС‹С‚РѕРє, СѓРїСЂР°РІР»РµРЅРёРµ РІРѕРїСЂРѕСЃР°РјРё, РёРјРїРѕСЂС‚.{' '}
          <Link to="/admin" className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
            РћС‚РєСЂС‹С‚СЊ /admin
          </Link>
        </p>
      </div>
    </div>
  )
}

