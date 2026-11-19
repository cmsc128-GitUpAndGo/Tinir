-- FR7 (#14): a question must contain visible text. trim() only strips spaces, so a question made of tabs or
-- line breaks passed the old check. Reject any message that has nothing but whitespace.

alter table app_private.inquiries drop constraint inquiries_check;
alter table app_private.inquiries add constraint inquiries_question_has_text
  check (type <> 'question' or message is not null and message ~ '[^[:space:]]');
