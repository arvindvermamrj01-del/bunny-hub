-- Optional display-name fix after Master Setup.
-- Uses a neutral label; change the text if you want a different admin display name.
update public.profiles
set fullname = 'BunnyHub Admin'
where id = '1c68e22e-70d6-49ac-ba96-75784dc043e9'::uuid
  and (fullname is null or btrim(fullname) = '');

select id, fullname, role
from public.profiles
where id = '1c68e22e-70d6-49ac-ba96-75784dc043e9'::uuid;
