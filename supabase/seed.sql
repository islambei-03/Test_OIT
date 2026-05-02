-- Seed data for the MVP
-- Insert default categories and example questions (min 20 questions total).

-- Categories
insert into public.categories (name) values
  ('Информационная безопасность'),
  ('Windows'),
  ('Сети'),
  ('BIOS'),
  ('Active Directory'),
  ('Общие ИТ вопросы')
on conflict (name) do nothing;

-- Helper: insert one question + 4 answers (option_index 0..3)

-- =========================
-- Информационная безопасность
-- =========================

with q as (
  insert into public.questions (category_id, question_text, explanation)
  values (
    (select id from public.categories where name = 'Информационная безопасность'),
    'Что такое фишинг?',
    'Фишинг — это метод социальной инженерии, при котором злоумышленник пытается выманить пароли/данные, выдавая себя за доверенный источник.'
  )
  returning id
)
insert into public.exam_answers (question_id, option_index, option_text, is_correct)
select q.id, 0, 'Отправку вредоносных писем с вложениями', false from q
union all select q.id, 1, 'Социальную инженерию для выманивания данных', true from q
union all select q.id, 2, 'Только атаку через DDoS', false from q
union all select q.id, 3, 'Безопасный обмен файлами', false from q;

with q as (
  insert into public.questions (category_id, question_text, explanation)
  values (
    (select id from public.categories where name = 'Информационная безопасность'),
    'Для чего используется многофакторная аутентификация (MFA)?',
    'MFA повышает безопасность, требуя подтверждение входа как минимум из двух независимых факторов.'
  )
  returning id
)
insert into public.exam_answers (question_id, option_index, option_text, is_correct)
select q.id, 0, 'Чтобы увеличить скорость работы приложений', false from q
union all select q.id, 1, 'Чтобы снизить необходимость резервных копий', false from q
union all select q.id, 2, 'Чтобы усложнить доступ злоумышленников к аккаунту', true from q
union all select q.id, 3, 'Чтобы отменить требования к паролям', false from q;

with q as (
  insert into public.questions (category_id, question_text, explanation)
  values (
    (select id from public.categories where name = 'Информационная безопасность'),
    'Какой подход к паролям наиболее безопасен?',
    'Безопасная практика — длинные уникальные пароли + менеджер паролей или, где возможно, SSO/MFA.'
  )
  returning id
)
insert into public.exam_answers (question_id, option_index, option_text, is_correct)
select q.id, 0, 'Один и тот же пароль для всех сервисов', false from q
union all select q.id, 1, 'Длинный уникальный пароль и/или менеджер паролей', true from q
union all select q.id, 2, 'Пароль из 4–6 символов без уникальности', false from q
union all select q.id, 3, 'Пароль в открытом виде в заметках', false from q;

with q as (
  insert into public.questions (category_id, question_text, explanation)
  values (
    (select id from public.categories where name = 'Информационная безопасность'),
    'Что делать при подозрении на инцидент безопасности?',
    'Нужно прекратить дальнейшие действия, зафиксировать факт и сообщить в ИБ/службу безопасности компании по установленной процедуре.'
  )
  returning id
)
insert into public.exam_answers (question_id, option_index, option_text, is_correct)
select q.id, 0, 'Игнорировать, чтобы не тратить время', false from q
union all select q.id, 1, 'Немедленно сообщить в ИБ и следовать инструкциям', true from q
union all select q.id, 2, 'Передать письмо/файл всем коллегам для проверки', false from q
union all select q.id, 3, 'Удалить любые следы сразу', false from q;

-- =========================
-- Windows
-- =========================

with q as (
  insert into public.questions (category_id, question_text, explanation)
  values (
    (select id from public.categories where name = 'Windows'),
    'Для чего используется команда `gpupdate /force`?',
    'Команда принуждает клиент обновить политики безопасности/групповые политики (Group Policy).'
  )
  returning id
)
insert into public.exam_answers (question_id, option_index, option_text, is_correct)
select q.id, 0, 'Перезапускает службы обновления Windows', false from q
union all select q.id, 1, 'Принудительно обновляет групповые политики', true from q
union all select q.id, 2, 'Отключает доменные политики', false from q
union all select q.id, 3, 'Сбрасывает кэш браузера', false from q;

with q as (
  insert into public.questions (category_id, question_text, explanation)
  values (
    (select id from public.categories where name = 'Windows'),
    'Где посмотреть журнал событий Windows?',
    'Журналы событий доступны через “Просмотр событий” (Event Viewer).'
  )
  returning id
)
insert into public.exam_answers (question_id, option_index, option_text, is_correct)
select q.id, 0, 'Только в браузере Chrome', false from q
union all select q.id, 1, 'В “Просмотре событий” (Event Viewer)', true from q
union all select q.id, 2, 'Нигде, события не сохраняются', false from q
union all select q.id, 3, 'В диспетчере устройств', false from q;

with q as (
  insert into public.questions (category_id, question_text, explanation)
  values (
    (select id from public.categories where name = 'Windows'),
    'Что означает разрешение “Read & Execute” (Чтение и выполнение)?',
    'Позволяет читать и запускать/выполнять файлы, но обычно не позволяет изменять или записывать.'
  )
  returning id
)
insert into public.exam_answers (question_id, option_index, option_text, is_correct)
select q.id, 0, 'Полный доступ (изменение и удаление)', false from q
union all select q.id, 1, 'Чтение и запуск/выполнение без возможности изменения', true from q
union all select q.id, 2, 'Только удаление без чтения', false from q
union all select q.id, 3, 'Запрет на чтение и выполнение', false from q;

with q as (
  insert into public.questions (category_id, question_text, explanation)
  values (
    (select id from public.categories where name = 'Windows'),
    'Какой командой обычно проверяют IP-адреса и сетевые параметры?',
    'Команда `ipconfig` показывает текущую конфигурацию сети.'
  )
  returning id
)
insert into public.exam_answers (question_id, option_index, option_text, is_correct)
select q.id, 0, 'ipconfig', true from q
union all select q.id, 1, 'pingroot', false from q
union all select q.id, 2, 'routeprintx', false from q
union all select q.id, 3, 'dir /ip', false from q;

-- =========================
-- Сети
-- =========================

with q as (
  insert into public.questions (category_id, question_text, explanation)
  values (
    (select id from public.categories where name = 'Сети'),
    'Какой протокол используется для DNS-запросов?',
    'DNS работает по протоколам UDP и/или TCP (обычно порт 53).'
  )
  returning id
)
insert into public.exam_answers (question_id, option_index, option_text, is_correct)
select q.id, 0, 'HTTP (порт 80/443)', false from q
union all select q.id, 1, 'DNS (порт 53)', true from q
union all select q.id, 2, 'FTP (порт 21)', false from q
union all select q.id, 3, 'SMTP (порт 25)', false from q;

with q as (
  insert into public.questions (category_id, question_text, explanation)
  values (
    (select id from public.categories where name = 'Сети'),
    'Какой слой в модели OSI отвечает за маршрутизацию?',
    'Маршрутизацию выполняет сетевой слой (Layer 3).'
  )
  returning id
)
insert into public.exam_answers (question_id, option_index, option_text, is_correct)
select q.id, 0, 'Слой 2 (канальный)', false from q
union all select q.id, 1, 'Слой 3 (сетевой)', true from q
union all select q.id, 2, 'Слой 7 (прикладной)', false from q
union all select q.id, 3, 'Слой 1 (физический)', false from q;

with q as (
  insert into public.questions (category_id, question_text, explanation)
  values (
    (select id from public.categories where name = 'Сети'),
    'В чём основное различие TCP и UDP?',
    'TCP обеспечивает надежную доставку (контроль соединения и повтор при ошибках), UDP — без гарантии доставки.'
  )
  returning id
)
insert into public.exam_answers (question_id, option_index, option_text, is_correct)
select q.id, 0, 'UDP всегда гарантирует доставку, а TCP — нет', false from q
union all select q.id, 1, 'TCP надежен, UDP не гарантирует доставку', true from q
union all select q.id, 2, 'Оба протокола одинаковые по доставке', false from q
union all select q.id, 3, 'TCP используется только для видео, UDP — только для почты', false from q;

with q as (
  insert into public.questions (category_id, question_text, explanation)
  values (
    (select id from public.categories where name = 'Сети'),
    'Зачем нужна маска подсети (subnet mask)?',
    'Маска подсети определяет, какая часть IP-адреса относится к сети, а какая — к хосту.'
  )
  returning id
)
insert into public.exam_answers (question_id, option_index, option_text, is_correct)
select q.id, 0, 'Определяет тип кабеля (UTP/Fiber)', false from q
union all select q.id, 1, 'Разделяет адрес на сеть и хост', true from q
union all select q.id, 2, 'Шифрует трафик', false from q
union all select q.id, 3, 'Определяет MAC-адрес', false from q;

-- =========================
-- BIOS / UEFI
-- =========================

with q as (
  insert into public.questions (category_id, question_text, explanation)
  values (
    (select id from public.categories where name = 'BIOS'),
    'Что обычно задают в BIOS/UEFI для запуска компьютера?',
    'Обычно задают порядок загрузки устройств (Boot Order), чтобы выбрать, откуда загрузиться.'
  )
  returning id
)
insert into public.exam_answers (question_id, option_index, option_text, is_correct)
select q.id, 0, 'Только язык клавиатуры', false from q
union all select q.id, 1, 'Порядок загрузки (Boot Order)', true from q
union all select q.id, 2, 'Настройки шифрования файлов пользователя', false from q
union all select q.id, 3, 'Настройки антивируса в Windows', false from q;

with q as (
  insert into public.questions (category_id, question_text, explanation)
  values (
    (select id from public.categories where name = 'BIOS'),
    'Чем UEFI отличается от Legacy BIOS?',
    'UEFI — современная прошивка, поддерживающая более удобную загрузку, 64-битные системы и Secure Boot.'
  )
  returning id
)
insert into public.exam_answers (question_id, option_index, option_text, is_correct)
select q.id, 0, 'UEFI поддерживает только 16-битные ОС', false from q
union all select q.id, 1, 'UEFI более современная прошивка и поддерживает Secure Boot', true from q
union all select q.id, 2, 'UEFI не умеет загружаться с SSD', false from q
union all select q.id, 3, 'Legacy BIOS работает быстрее UEFI во всех случаях', false from q;

with q as (
  insert into public.questions (category_id, question_text, explanation)
  values (
    (select id from public.categories where name = 'BIOS'),
    'Что защищает Secure Boot?',
    'Secure Boot контролирует подписи загрузчика/ОС и помогает предотвратить запуск неподписанного кода.'
  )
  returning id
)
insert into public.exam_answers (question_id, option_index, option_text, is_correct)
select q.id, 0, 'Только пароль BIOS', false from q
union all select q.id, 1, 'Процесс загрузки от неподписанного кода', true from q
union all select q.id, 2, 'Трафик Wi‑Fi в операционной системе', false from q
union all select q.id, 3, 'Удаление временных файлов Windows', false from q;

with q as (
  insert into public.questions (category_id, question_text, explanation)
  values (
    (select id from public.categories where name = 'BIOS'),
    'Для чего используется TPM?',
    'TPM (Trusted Platform Module) хранит криптографические ключи и помогает поддерживать функции безопасности, включая подтверждение целостности.'
  )
  returning id
)
insert into public.exam_answers (question_id, option_index, option_text, is_correct)
select q.id, 0, 'Для ускорения рендеринга видеокарты', false from q
union all select q.id, 1, 'Для хранения криптографических ключей и мер доверенной платформы', true from q
union all select q.id, 2, 'Только для чтения флешек', false from q
union all select q.id, 3, 'Для увеличения скорости диска без криптографии', false from q;

-- =========================
-- Active Directory
-- =========================

with q as (
  insert into public.questions (category_id, question_text, explanation)
  values (
    (select id from public.categories where name = 'Active Directory'),
    'Что такое Domain Controller (DC)?',
    'DC — сервер Active Directory, который хранит базу каталога и обеспечивает аутентификацию/авторизацию.'
  )
  returning id
)
insert into public.exam_answers (question_id, option_index, option_text, is_correct)
select q.id, 0, 'Клиентский компьютер без роли AD', false from q
union all select q.id, 1, 'Сервер, который хранит AD и аутентифицирует пользователей', true from q
union all select q.id, 2, 'Приложение для настройки принтеров', false from q
union all select q.id, 3, 'Компонент только для DNS-зон', false from q;

with q as (
  insert into public.questions (category_id, question_text, explanation)
  values (
    (select id from public.categories where name = 'Active Directory'),
    'Как называется механизм AD, применяющий политики на пользователей и компьютеры?',
    'Групповые политики применяются через Group Policy (GPO).'
  )
  returning id
)
insert into public.exam_answers (question_id, option_index, option_text, is_correct)
select q.id, 0, 'GDI', false from q
union all select q.id, 1, 'GPO (Group Policy Object)', true from q
union all select q.id, 2, 'DHCP Scope', false from q
union all select q.id, 3, 'NAT Rules', false from q;

with q as (
  insert into public.questions (category_id, question_text, explanation)
  values (
    (select id from public.categories where name = 'Active Directory'),
    'Какой протокол чаще всего используется для аутентификации в домене Kerberos?',
    'Kerberos — протокол аутентификации в Windows доменах.'
  )
  returning id
)
insert into public.exam_answers (question_id, option_index, option_text, is_correct)
select q.id, 0, 'Kerberos', true from q
union all select q.id, 1, 'HTTP', false from q
union all select q.id, 2, 'SNMP', false from q
union all select q.id, 3, 'ICMP', false from q;

with q as (
  insert into public.questions (category_id, question_text, explanation)
  values (
    (select id from public.categories where name = 'Active Directory'),
    'Что такое OU (Organizational Unit) в Active Directory?',
    'OU — организационные единицы, используемые для структуры домена и делегирования управления.'
  )
  returning id
)
insert into public.exam_answers (question_id, option_index, option_text, is_correct)
select q.id, 0, 'Единица измерения сетевого трафика', false from q
union all select q.id, 1, 'Организационная единица для структуры домена', true from q
union all select q.id, 2, 'Тип учетной записи в Windows', false from q
union all select q.id, 3, 'Сервис для резервного копирования', false from q;

-- =========================
-- Общие ИТ вопросы
-- =========================

with q as (
  insert into public.questions (category_id, question_text, explanation)
  values (
    (select id from public.categories where name = 'Общие ИТ вопросы'),
    'Что такое резервное копирование (backup) и почему важно “3-2-1”?',
    'Принцип 3-2-1 уменьшает риски: 3 копии, 2 разных носителя, 1 копия вне основной площадки.'
  )
  returning id
)
insert into public.exam_answers (question_id, option_index, option_text, is_correct)
select q.id, 0, 'Это отключение систем от сети', false from q
union all select q.id, 1, 'Это наличие нескольких копий данных на разных носителях и местах', true from q
union all select q.id, 2, 'Это замена антивируса', false from q
union all select q.id, 3, 'Это ускорение работы диска', false from q;

with q as (
  insert into public.questions (category_id, question_text, explanation)
  values (
    (select id from public.categories where name = 'Общие ИТ вопросы'),
    'Чем виртуализация отличается от эмуляции?',
    'Виртуализация обычно использует средства аппаратного/гипервизорного разделения ресурсов, тогда как эмуляция переводит/имитирует другую архитектуру.'
  )
  returning id
)
insert into public.exam_answers (question_id, option_index, option_text, is_correct)
select q.id, 0, 'Виртуализация всегда медленнее эмуляции', false from q
union all select q.id, 1, 'Виртуализация чаще использует гипервизор и разделение ресурсов', true from q
union all select q.id, 2, 'Виртуализация не требует железа', false from q
union all select q.id, 3, 'Виртуализация = установка Windows на новый компьютер', false from q;

with q as (
  insert into public.questions (category_id, question_text, explanation)
  values (
    (select id from public.categories where name = 'Общие ИТ вопросы'),
    'Что такое SLA (Service Level Agreement)?',
    'SLA — соглашение об уровне сервиса: например сроки реакции/восстановления и метрики качества.'
  )
  returning id
)
insert into public.exam_answers (question_id, option_index, option_text, is_correct)
select q.id, 0, 'Договор о покупке лицензии', false from q
union all select q.id, 1, 'Соглашение об уровнях сервиса (метрики поддержки)', true from q
union all select q.id, 2, 'Только политика паролей', false from q
union all select q.id, 3, 'Документ по дизайну интерфейсов', false from q;

with q as (
  insert into public.questions (category_id, question_text, explanation)
  values (
    (select id from public.categories where name = 'Общие ИТ вопросы'),
    'Что означает принцип наименьших привилегий (Least Privilege)?',
    'Каждый пользователь/сервис должен иметь только те права, которые необходимы для выполнения задач.'
  )
  returning id
)
insert into public.exam_answers (question_id, option_index, option_text, is_correct)
select q.id, 0, 'Давать всем максимальные права для удобства', false from q
union all select q.id, 1, 'Выдавать ровно необходимые права', true from q
union all select q.id, 2, 'Отключать все политики доступа', false from q
union all select q.id, 3, 'Использовать админ-пароль вместо прав', false from q;

