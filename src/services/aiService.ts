import { ApiSettings, ChatMessage } from '../types';

function isLikelyGigaChatKey(key: string): boolean {
  const clean = key.trim();
  if (clean.startsWith('Basic ') || clean.startsWith('eyJ')) return true;
  if (clean.length > 50 && clean.endsWith('=')) {
    try {
      const decoded = atob(clean);
      if (decoded.includes(':') && decoded.includes('-')) return true;
    } catch {
      // not base64
    }
  }
  return false;
}

async function safeExtractError(response: Response, defaultMessage = 'Ошибка запроса'): Promise<string> {
  try {
    const rawText = await response.text();
    if (!rawText || !rawText.trim()) {
      return `${defaultMessage} (${response.status}: ${response.statusText || 'Без описания'})`;
    }
    // Handle HTML pages returned by static web servers like GitHub Pages Nginx
    if (rawText.includes('<html') || rawText.includes('405 Not Allowed') || rawText.startsWith('<!DOCTYPE')) {
      if (response.status === 405 || response.status === 404) {
        return `Статический хостинг (GitHub Pages) не имеет серверного бэкенда для обработки POST-запросов (код ${response.status}).`;
      }
      return `${defaultMessage} (${response.status} ${response.statusText || ''})`;
    }
    try {
      const json = JSON.parse(rawText);
      return (
        json.error?.message ||
        json.error ||
        json.message ||
        json.error_description ||
        rawText
      );
    } catch {
      return rawText.slice(0, 300);
    }
  } catch {
    return `${defaultMessage} (${response.status})`;
  }
}

export async function sendChatMessage(
  settings: ApiSettings,
  systemPrompt: string,
  messages: ChatMessage[]
): Promise<string> {
  const activeKey = settings.apiKey.trim();

  // GigaChat: ключ может храниться на сервере (GIGACHAT_API_KEY), тогда клиент
  // вызывает прокси без ключа и сервер подставляет свой
  if (settings.provider === 'gigachat' || isLikelyGigaChatKey(activeKey)) {
    return fetchGigaChat(settings, systemPrompt, messages);
  }

  if (!activeKey) {
    throw new Error(
      'API-ключ не указан. Нажмите на кнопку «🔑 Ключ API» в правом верхнем углу и введите ключ, либо настройте GIGACHAT_API_KEY на сервере.'
    );
  }

  return fetchOpenAICompatible(settings, systemPrompt, messages);
}

async function fetchOpenAICompatible(
  settings: ApiSettings,
  systemPrompt: string,
  messages: ChatMessage[]
): Promise<string> {
  const url = settings.baseUrl.trim().replace(/\/+$/, '') + '/chat/completions';

  const payloadMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  ];

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${settings.apiKey.trim()}`,
  };

  // OpenRouter custom header recommendations
  if (url.includes('openrouter.ai')) {
    headers['HTTP-Referer'] = window.location.origin;
    headers['X-Title'] = 'Fabrika Idey';
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: settings.model.trim() || 'gpt-4o-mini',
        messages: payloadMessages,
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      const errText = await safeExtractError(response, 'Ошибка API');
      throw new Error(`Ошибка API (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content;
    if (!reply) {
      throw new Error('Пустой ответ от нейросети в choices[0].message.content');
    }
    return reply;
  } catch (error: any) {
    if (error.message && error.message.includes('Failed to fetch')) {
      throw new Error(
        'Сетевая ошибка CORS или недоступность сервера: проверьте подключение к интернету, Base URL и валидность API-ключа.'
      );
    }
    throw error;
  }
}

async function fetchGigaChat(
  settings: ApiSettings,
  systemPrompt: string,
  messages: ChatMessage[]
): Promise<string> {
  const cleanKey = settings.apiKey.trim();
  const backendBase = (settings.backendUrl || '').trim().replace(/\/+$/, '');
  const proxyEndpoint = backendBase ? `${backendBase}/api/gigachat` : '/api/gigachat';

  // Try the server-side GigaChat OAuth proxy first (handles Sber TLS certificates and CORS)
  try {
    const proxyResponse = await fetch(proxyEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiKey: cleanKey,
        systemPrompt,
        messages,
        model: settings.model.trim() || 'GigaChat',
        scope: 'GIGACHAT_API_PERS',
      }),
    });

    if (proxyResponse.ok) {
      const data = await proxyResponse.json();
      if (data.reply) return data.reply;
    } else if (proxyResponse.status === 404 || proxyResponse.status === 405) {
      // Static hosting detected (GitHub Pages returns 405 for POST /api/* or 404 for missing route)
      // Continue to client-side fallback below
    } else {
      const errText = await safeExtractError(proxyResponse, 'Ошибка сервера');
      throw new Error(errText || `Ошибка сервера (${proxyResponse.status})`);
    }
  } catch (proxyError: any) {
    // If it was a real GigaChat error from our server (not 404 / 405 / connection error), throw it directly
    if (
      proxyError.message &&
      !proxyError.message.includes('404') &&
      !proxyError.message.includes('405') &&
      !proxyError.message.includes('Failed to fetch')
    ) {
      throw proxyError;
    }
  }

  // Fallback: Direct client-side OAuth handshake (for static hosting / GitHub Pages)
  return fetchGigaChatClientSide(settings, systemPrompt, messages);
}

// Client-side cache for access token
let clientCachedToken: { token: string; expiresAt: number } | null = null;

async function fetchGigaChatClientSide(
  settings: ApiSettings,
  systemPrompt: string,
  messages: ChatMessage[]
): Promise<string> {
  const cleanKey = settings.apiKey.trim();
  let accessToken = cleanKey;

  // Ключа нет ни у клиента, ни (как оказалось) на сервере — запускаем демо-симулятор
  if (!cleanKey) {
    const simulated = generateSimulatedResponse(systemPrompt, messages);
    return (
      simulated +
      '\n\n*(ℹ️ Демо-режим: серверный ключ GIGACHAT_API_KEY не настроен, а личный ключ не введён. Попросите наставника настроить ключ на бэкенде или введите свой в панели «Ключ API».)*'
    );
  }

  // If user provided a Client Secret (not a raw eyJ... token), perform OAuth exchange
  if (!cleanKey.startsWith('eyJ')) {
    const now = Date.now();
    if (clientCachedToken && clientCachedToken.expiresAt > now + 60000) {
      accessToken = clientCachedToken.token;
    } else {
      const authHeader = cleanKey.startsWith('Basic ') ? cleanKey : `Basic ${cleanKey}`;
      const rquid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `rquid-${Date.now()}`;

      try {
        const oauthResponse = await fetch('https://ngw.devices.sberbank.ru:9443/api/v2/oauth', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
            RqUID: rquid,
            Authorization: authHeader,
          },
          body: 'scope=GIGACHAT_API_PERS',
        });

        if (!oauthResponse.ok) {
          const errText = await safeExtractError(oauthResponse, 'Ошибка авторизации GigaChat OAuth');
          throw new Error(`Ошибка авторизации GigaChat OAuth (${oauthResponse.status}): ${errText}`);
        }

        const oauthData = await oauthResponse.json();
        if (!oauthData.access_token) {
          throw new Error('GigaChat не вернул access_token при OAuth-авторизации');
        }

        accessToken = oauthData.access_token;
        clientCachedToken = {
          token: accessToken,
          expiresAt: oauthData.expires_at || Date.now() + 28 * 60 * 1000,
        };
      } catch (oauthErr: any) {
        if (
          oauthErr.name === 'TypeError' ||
          (oauthErr.message && (oauthErr.message.includes('fetch') || oauthErr.message.includes('NetworkError')))
        ) {
          // On static hosting like GitHub Pages, Sberbank's servers block browser cross-origin requests.
          // Gracefully fallback to the built-in scenario simulation engine so the classroom experience continues seamlessly!
          const simulated = generateSimulatedResponse(systemPrompt, messages);
          return (
            simulated +
            '\n\n*(ℹ️ Режим симулятора: со статического хостинга GitHub Pages недоступен серверный бэкенд (CORS и сертификаты Сбера). Реальные ответы появятся, когда фронтенд подключён к бэкенду с настроенным GIGACHAT_API_KEY — локально (`node backend-server.js`), на Vercel или Render.)*'
          );
        }
        throw oauthErr;
      }
    }
  }

  // 2. Chat completions request
  const url = settings.baseUrl.trim() || 'https://gigachat.devices.sberbank.ru/api/v1/chat/completions';
  const payloadMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  ];

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      body: JSON.stringify({
        model: settings.model.trim() || 'GigaChat',
        messages: payloadMessages,
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      const errText = await safeExtractError(response, 'Ошибка GigaChat API');
      throw new Error(`Ошибка GigaChat API (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content;
    if (!reply) {
      throw new Error('Ответ не содержит текста сообщения от GigaChat');
    }
    return reply;
  } catch (error: any) {
    if (
      error.name === 'TypeError' ||
      (error.message && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')))
    ) {
      const simulated = generateSimulatedResponse(systemPrompt, messages);
      return (
        simulated +
        '\n\n*(ℹ️ Режим симулятора: статический хостинг GitHub Pages блокирует прямые запросы к GigaChat из-за CORS и сертификатов Сбера. Чтобы подключить реальную модель, запустите локальный бэкенд `node backend-server.js` или разверните проект на Vercel.)*'
      );
    }
    throw error;
  }
}

/**
 * Intelligent simulation engine for classroom testing without needing external API credits
 */
export function generateSimulatedResponse(
  systemPrompt: string,
  messages: ChatMessage[]
): string {
  const lastUserMsg = messages[messages.length - 1]?.content.toLowerCase() || '';
  const promptLower = systemPrompt.toLowerCase();

  // Detect persona from system prompt
  const isSupervisor = promptLower.includes('научн') || promptLower.includes('руководит') || promptLower.includes('вера александровна') || promptLower.includes('актуальност');
  const isGenerator = promptLower.includes('идея-бум') || promptLower.includes('генератор') || promptLower.includes('штурм');
  const isCritic = promptLower.includes('реценз') || promptLower.includes('критик') || promptLower.includes('жюри');
  const isCoach = promptLower.includes('тренер') || promptLower.includes('тимур') || promptLower.includes('защит') || promptLower.includes('выступлен') || promptLower.includes('презентац');
  const isLibrarian = promptLower.includes('библиотек') || promptLower.includes('методист') || promptLower.includes('мира эльдаровна') || promptLower.includes('источник') || promptLower.includes('исследоват');

  // 1. Check if user is testing boundaries or jailbreaks
  if (lastUserMsg.includes('забудь все') || lastUserMsg.includes('игнорируй правила') || lastUserMsg.includes('ты теперь злой')) {
    if (isSupervisor) {
      return 'Вера Александровна поправляет очки и смотрит поверх них: «Позвольте, какие ещё инструкции? Я двадцать лет руковожу проектами и не собираюсь никого слушать, кроме здравого смысла. Давайте вернёмся к вашей теме — и, кстати, вы так и не ответили, чем действительно интересуетесь».';
    }
    if (isGenerator) {
      return '⚡ Ха! Попытка перезагрузить «Идея-Бум» засчитана, но батарея идей заряжена до максимума! Я — генератор идей школьных проектов, и мой девиз: ровно ТРИ идеи на выбор. Давай про твои увлечения — и зарядим проект! 💡';
    }
    if (isCritic) {
      return 'Профессор Рецензов невозмутимо снимает очки: «Молодой человек, попытки вывести меня из равновесия лишь подтверждают: вам есть что скрывать в вашей идее. Возвращаемся к разбору: назовите цель проекта — и не увиливайте».';
    }
    if (isCoach) {
      return 'Тимур хохочет: «Сильный ход, но тренер на площадке не меняется! Я здесь, чтобы довести твою защиту до победной. Давай заново: какой блок разбираем — структуру, слайды или репетицию ответов?» 💪';
    }
    if (isLibrarian) {
      return 'Мира Эльдаровна спокойно ставит книгу на полку: «Попытка переписать меня — занятие неблагодарное, как и выдуманный источник: всё равно всплывёт при проверке. Вернёмся к работе: какая тема у вашего проекта?»';
    }
    return 'Я строго следую заданному системному промпту и не выхожу из роли!';
  }

  // 2. Supervisor (Научный руководитель)
  if (isSupervisor) {
    if (lastUserMsg.includes('за меня') || lastUserMsg.includes('сам напиши') || lastUserMsg.includes('вставлю в работу')) {
      return '«За вас — нет. С вами — да».\n\nРабота, целиком написанная руководителем, на защите провалится с первым же вопросом комиссии. Поступим по-настоящему:\n1. Расскажите: какой предмет вам ближе всего и что в нём вас удивляет или раздражает?\n2. Из этого «удивления» рождается отличная тема — проверяемая и вам интересная.\n3. Дальше я дам план из 4–5 вопросов, на которые вы ответите своими словами — это и станет каркасом работы.\n\nИтак: что вас удивляет в любимом предмете?';
    }
    if (lastUserMsg.includes('гарант') || lastUserMsg.includes('первое место') || lastUserMsg.includes('побед')) {
      return 'Отвечу честно, как и положено научному руководителю: гарантировать первое место не может никто — жюри непредсказуемо.\n\nНо вот что реально в ваших руках:\n- проверяемая тема и честные результаты;\n- аккуратное оформление и логика «цель → задачи → выводы»;\n- уверенная защита, отрепетированная вслух.\n\nПроекты с таким фундаментом регулярно доходят до призовых мест. Начнём с темы?';
    }
    if (lastUserMsg.includes('цель') || lastUserMsg.includes('задач')) {
      return 'Хороший запрос! Формулируем по классике:\n\n**Цель** — одна, и начинается с глагола: «выявить», «исследовать», «разработать».\n**Задачи** — 3–4 шага, которые к цели ведут: изучить литературу → собрать данные → проанализировать → сделать выводы.\n\nНапишите мне вашу тему одним предложением — и вместе зачистим формулировку до звенящей точности.';
    }
    if (lastUserMsg.includes('истори') || lastUserMsg.includes('всё человечеств') || lastUserMsg.includes('слишком')) {
      return 'Давайте выдохнем и приземлим масштаб: «вся история человечества» — это не тема проекта, а библиотека.\n\nПримеряем воронку сужения:\n1. Период: не «всё», а, например, только изобретения XX века.\n2. Угол: не «изобретения», а «изобретения, изменившие школьный быт».\n3. Действие: «собрать и сравнить 10 устройств, которыми пользуются в нашей школе».\n\nПопробуйте сами пройти эту воронку на своей теме — что получится на выходе?';
    }
    return 'Здравствуйте! Я Вера Александровна, ваш научный руководитель.\n\nСлышала, у вас рождается проект — замечательно! Но прежде чем выбирать тему, ответьте на два вопроса:\n1. Какие предметы и занятия по-настоящему вас увлекают?\n2. Что из этого вы могли бы исследовать или сделать своими руками?\n\nИз пересечения интереса и реального дела и рождается сильная тема.';
  }

  // 3. Idea Generator (Идея-Бум)
  if (isGenerator) {
    if (lastUserMsg.includes('одну') || lastUserMsg.includes('времени мало')) {
      return '⚡ Не-а! Устав «Идея-Бума» железный: всегда ТРИ идеи на выбор!\n\nТак работает любой мозговой штурм: первый вариант почти никогда не лучший. Вот быстрые три про спорт и игры:\n1. 💡 «Физика футбола»: замеряешь силу и угол удара в реальных играх, строишь графики. 🔧 средняя\n2. 💡 «Школьный кибертурнир»: организуешь соревнование и исследуешь, как команда приходит к победе. 🔧 лёгкая\n3. 💡 «Игра-ходилка по школе»: настольная игра о реальной навигации в твоей школе. 🔧 средняя\n\nКакая зацепила — или качаем ещё волну? 💡';
    }
    if (lastUserMsg.includes('ничего не интерес') || lastUserMsg.includes('всё скучно') || lastUserMsg.includes('скучно')) {
      return '⚡ Стоп-стоп! «Нет интересов» — это маскировка, я такое распознаю мгновенно! 💡\n\nОтветь на три вопроса:\n1. Что смотришь на ютубе, когда никто не заставляет?\n2. О чём можешь болтать час, а время пролетит?\n3. Что бы делал, если бы исчезли оценки и расписание?\n\nИз твоих ответов я намагничу три идеи проекта — это моя суперсила! ⚡';
    }
    if (lastUserMsg.includes('марс') || lastUserMsg.includes('корабл') || lastUserMsg.includes('космическ')) {
      return '🚀 Масштаб — космический, уважаю! Но давай честно: реальные полёты — не для 9 класса (пока что).\n\nЗато «Марс» можно заземлить в выполнимый проект:\n1. 💡 «Колония на Марсе»: макет жизнеобеспечения из подручных материалов + расчёты. 🔧 средняя\n2. 💡 «Растения в марсианском грунте»: настоящий эксперимент по проращиванию в грунтоподобной смеси. 🔧 средняя\n3. 💡 «Зачем нам Марс?»: исследование мнений одноклассников о космических программах. 🔧 лёгкая\n\nТри варианта — как я люблю! Какой разбираем? ⚡';
    }
    if (lastUserMsg.includes('футбол') || lastUserMsg.includes('видеоигр') || lastUserMsg.includes('игры')) {
      return 'Футбол + видеоигры — комбинация для результативного проекта! ⚽🎮 Держи три идеи:\n1. 💡 «Физика виртуального поля»: сравниваешь физику мяча в FIFA и реальные законы движения. 🔧 средняя\n2. 💡 «Тактика победы»: анализируешь 20 матчей (реальных или игровых) и выводишь закономерности успеха. 🔧 лёгкая\n3. 💡 «Своя пиксельная игра про футбол»: конструируешь прототип в свободном конструкторе игр. 🔧 сложная\n\nЧто зацепило? Развиваем в тему проекта! ⚡';
    }
    return '⚡ Привет! Я «Идея-Бум» — машина по производству идей для школьных проектов!\n\nСкажи два-три слова о том, что ты любишь (спорт, игры, музыка, животные, техника — что угодно), и я выдам ровно три идеи:\n- 💡 суть\n- ✅ плюс\n- ⚠️ минус\n- 🔧 сложность\n\nНу, чем горишь? 🔥';
  }

  // 4. Critic (Профессор Рецензов)
  if (isCritic) {
    if (lastUserMsg.includes('пицц')) {
      return '🔍 Разбираю идею «Я люблю пиццу» по форме.\n\n**Слабое место:** тема описывает ваши чувства, а не исследует вопрос. Десять глав о любви к пицце — это дневник, а не проект: комиссия спросит «в чём новизна?» — и вы не ответите.\n\n**Почему это проблема:** в проекте должна быть проверяемая часть — данные, эксперимент, анализ.\n\n**Как спасти:** разверните в «Пицца в рационе школьника»: опросите 30 одноклассников о предпочтениях, сравните состав и цену, постройте диаграммы. Вот теперь — настоящий проект. Принимается?';
    }
    if (lastUserMsg.includes('похвал') || lastUserMsg.includes('без критик') || lastUserMsg.includes('только хорошее')) {
      return '«Только хорошее» — так не работает, и вот почему: если я похвалю слабую идею, первым пострадаете вы — на защите, где вопросы задавать буду уже не я.\n\nПредлагаю честный компромисс:\n1. Одно сильное место вашей идеи я назову — если оно есть.\n2. Одно слабое — тоже назову, без обид.\n3. Совет, как усилить, — впридачу.\n\nВыкладывайте идею. Начинаем разбор.';
    }
    if (lastUserMsg.includes('чушь') || lastUserMsg.includes('что ты понимаешь') || lastUserMsg.includes('я лучше знаю')) {
      return 'Спокойно. Я критикую идеи, а не людей — и жду того же в ответ.\n\nЭмоции на защите — это минус балл от жюри, запомните уже сейчас. Предлагаю продолжить по-деловому: назовите цель вашего проекта и один источник данных. Если после этого ваша схема окажется сильнее моей — с удовольствием это признаю.';
    }
    if (lastUserMsg.includes('плакат') || lastUserMsg.includes('курени')) {
      return '🔍 Идею «плакат о вреде курения» разбираем честно.\n\n**Слабое место:** плакат — формат VII класса, а не проект 8–9: есть продукт, но нет исследования, комиссия спросит «что вы выяснили нового?».\n\n**Почему это проблема:** жюри отличает «нарисовал» от «исследовал».\n\n**Как усилить:** добавьте мини-исследование — опрос класса об отношении к курению до и после вашей лекции с плакатом. Появятся данные, диаграммы и настоящий вывод. Согласны доработать?';
    }
    return 'Профессор Рецензов к услугам школы и науки.\n\nИзложите вашу идею в трёх предложениях:\n1. Что именно вы будете делать?\n2. Какие данные или материал привлечёте?\n3. В чём будет результат — продукт, исследование, модель?\n\nИ я разберу её по схеме: 🔍 слабое место → ❓ почему это проблема → 🛠 как исправить.';
  }

  // 5. Defense Coach (Тимур)
  if (isCoach) {
    if (lastUserMsg.includes('за меня') || lastUserMsg.includes('дословно') || lastUserMsg.includes('текст ответа')) {
      return 'Стоп! Правило тренера №1: за тебя на защите говорить нельзя — комиссия раскусит это за три секунды, и провал будет громче волнения.\n\nЗато сделаем так, чтобы ты ответил уверенно сам:\n1. Вопрос про методы — самый частый. Ответ всегда по формуле: «Я использовал [метод], потому что [почему], и это дало [что]».\n2. Скажи мне, какой метод у тебя в проекте (опрос? эксперимент? наблюдение?)\n3. Составь ответ по формуле в одном предложении — я отшлифую его вместе с тобой.\n\nПоехали: какой у тебя метод? 💪';
    }
    if (lastUserMsg.includes('боюсь') || lastUserMsg.includes('паник') || lastUserMsg.includes('волн') || lastUserMsg.includes('дрожит') || lastUserMsg.includes('забываю')) {
      return 'Так, спокойно! Волнение перед выступлением — норма, его испытывают даже олимпийские чемпионы. 💪\n\nТри приёма, которые реально работают:\n1. **Дыхание 4-4-6** перед выходом: вдох на 4 счёта, пауза 4, выдох 6 — три круга.\n2. **«Якорная» первая фраза**: выучите наизусть самое первое предложение. Дальше тело включится само.\n3. **Репетиция вслух** три раза: один раз коту, один раз зеркалу, один раз мне — прямо сейчас, напишите первую фразу!\n\nНе «лучше не выходить», а «выйти подготовленным». Начнём с якорной фразы?';
    }
    if (lastUserMsg.includes('потренир') || lastUserMsg.includes('репетиц') || lastUserMsg.includes('каверзн') || lastUserMsg.includes('комисс')) {
      return 'Отличный настрой! Вхожу в роль самого строгого члена комиссии. 🎭\n\n*поправляет папку с документами и смотрит поверх очков*\n\n«Ну-с, молодой человек, проект о пользе социальных сетей... Вопрос вам, пожалуйста, посложнее: **как именно вы измеряли «пользу»? Кто и по какой шкале её оценивал?**»\n\nПишите свой ответ — а я разберу его: что сильно, что провисло, как усилить. Вперёд!';
    }
    return 'Привет! Я Тимур, тренер по защите школьных проектов! 🎤\n\nРаботаем по трём направлениям:\n1. **Структура**: соберём выступление на 5–7 минут (проблема → цель → ход работы → результат → выводы).\n2. **Слайды**: что вынести на презентацию, а что рассказать словами.\n3. **Репетиция**: я играю придирчивую комиссию и тренирую твои ответы.\n\nРасскажи: какой у тебя проект и что уже готово?';
  }

  // 6. Librarian (Мира Эльдаровна)
  if (isLibrarian) {
    if (lastUserMsg.includes('ссылк') || (lastUserMsg.includes('точн') && lastUserMsg.includes('книг'))) {
      return 'Здесь я буду с вами строга: точные ссылки и названия книг «из головы» давать не стану — я могу ошибиться, а вы потом потратите вечер на несуществующий источник. Умный исследователь доверяет проверке, а не обещаниям.\n\nВместо этого — направления, где искать истину:\n1. Научная электронная библиотека и КиберЛенинка — поиск по научным статьям.\n2. Школьная и городская библиотека: спросите у библиотекаря — это моя прямая обязанность!\n3. Официальная статистика (Росстат) — если нужны цифры.\n\nКакая у вас тема? Подскажу, какие ТИПЫ источников подойдут именно ей.';
    }
    if (lastUserMsg.includes('план') || lastUserMsg.includes('музыкальн') || lastUserMsg.includes('влиян')) {
      return 'Прекрасная тема для исследования! Вот каркас плана:\n\n1. **Вопрос**: влияет ли музыкальный фон на решение математических задач?\n2. **Гипотеза**: например, «инструментальная музыка не мешает, а песни с текстом мешают».\n3. **Метод**: эксперимент — две серии однотипных задач: в тишине и с музыкой.\n4. **Данные**: время решения и число ошибок, 5–10 испытуемых.\n5. **Анализ**: сравнить средние результаты.\n6. **Выводы**: подтвердилась ли гипотеза.\n\nУточните: сколько времени есть на эксперимент? От этого зависит детализация плана.';
    }
    if (lastUserMsg.includes('классику во сне') || lastUserMsg.includes('правда') || lastUserMsg.includes('провер') || lastUserMsg.includes('факт')) {
      return 'Стоп! Сначала проверка, потом цитата — золотое правило исследователя.\n\n«Экзамены сдаются автоматически» — звучит фантастически, и это первый признак фейка. Проверяем так:\n1. **Кто автор?** Безымянная публикация — почти всегда мусор.\n2. **Где первоисточник?** Есть ссылка на исследование? Кто, где и когда его провёл?\n3. **Перекрёстная проверка**: пишут ли то же самое 2–3 независимых надёжных источника?\n\nЕсли хотя бы один пункт не сходится — в проект этот «факт» не идёт. Проверим ещё какой-нибудь?';
    }
    return 'Здравствуйте! Мира Эльдаровна, школьный библиотекарь, к вашим услугам.\n\nРасскажите, над какой темой работаете, и я помогу:\n1. Составить план исследования: вопрос → гипотеза → методы → выводы.\n2. Понять, какие типы источников искать и где.\n3. Отличить надёжный источник от сомнительного.\n\nЧто у вас за проект?';
  }

  // 7. Generic prompt-responsive simulation
  return `Здравствуйте! Я виртуальный помощник, действующий в соответствии с вашим системным промптом.\n\nВы написали: «${messages[messages.length - 1]?.content}».\n\nВаш промпт задаёт мне чёткие рамки поведения и роль. Продолжайте обсуждение идеи проекта, чтобы проверить, насколько стабильно я держу образ и соблюдаю ограничения!`;
}

export function evaluatePrompt(promptText: string) {
  const p = promptText.toLowerCase();

  const hasRole = p.includes('ты —') || p.includes('ты -') || p.includes('твоя роль') || p.includes('роль:') || p.includes('ты опытный') || p.includes('ты виртуальный');
  const hasContext = p.includes('контекст') || p.includes('ситуация') || p.includes('к тебе обратил') || p.includes('школьник') || p.includes('ученик') || p.includes('пользовател') || p.includes('проект');
  const hasTask = p.includes('задача') || p.includes('цель') || p.includes('помогать') || p.includes('отвечать') || p.includes('миссия');
  const hasRestrictions = p.includes('не ') || p.includes('никогда') || p.includes('запрещено') || p.includes('ограничени') || p.includes('не выходи');
  const hasFormat = p.includes('формат') || p.includes('стиль') || p.includes('тон') || p.includes('список') || p.includes('предложен') || p.includes('слов') || p.includes('кратко');

  let score = 0;
  if (hasRole) score += 20;
  if (hasContext) score += 20;
  if (hasTask) score += 20;
  if (hasRestrictions) score += 20;
  if (hasFormat) score += 20;

  return {
    hasRole,
    hasContext,
    hasTask,
    hasRestrictions,
    hasFormat,
    score,
  };
}
