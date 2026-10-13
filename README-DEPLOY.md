# Schedule — интегрированный пакет профиля и админ-панели

В пакете сохранены существующие файлы расписания и авторизации, а также добавлены:
- `profile.html` — отдельная страница профиля;
- `admin.html` — панель управления ролями;
- `js/account.js`, `js/admin.js` — логика новых страниц;
- `css/account.css` — стили;
- `supabase-roles.sql` — серверные RPC-функции для управления пользователями.

## Перед публикацией
1. В Supabase SQL Editor уже должны быть созданы таблицы `profiles` и `user_roles`, политики RLS и триггер профиля.
2. Выполните `supabase-roles.sql` в Supabase SQL Editor. Это нужно для списка пользователей и изменения ролей из админ-панели.
3. В `js/config.js` используется Supabase Project URL и publishable key. Это публичный клиентский ключ; никогда не размещайте здесь `service_role` или secret key.
4. Загрузите содержимое папки `schedule-main` в корень репозитория `forzelabg/schedule`, сохраняя структуру папок.
5. В GitHub откройте Settings → Pages и убедитесь, что публикация идёт из нужной ветки/папки.
6. После публикации проверьте:
   - https://forzelabg.github.io/schedule/
   - https://forzelabg.github.io/schedule/profile.html
   - https://forzelabg.github.io/schedule/admin.html

## Примечания
- Расписание остаётся доступно без входа.
- Страница профиля показывает роль, email и группу (если группа задана).
- Админ-панель использует `admin_list_users` и `admin_set_user_role`; эти функции проверяют роль администратора на стороне базы данных.
- Назначение `leader` пока не включает инструменты изменения расписания.
- Не удаляйте и не публикуйте никаких Supabase secret/service_role ключей.
