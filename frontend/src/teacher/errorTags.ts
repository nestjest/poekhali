// Error / bug tags from packages/judge (explain.py, detectors.py) in teacher language.
export const ERROR_TAG_RU: Record<string, string> = {
  blank_not_filled: 'Пропуск ___ не заполнен',
  case_sensitivity: 'Команда с большой буквы (Print)',
  undefined_name: 'Неизвестное имя (NameError)',
  str_plus_int: 'Текст + число без str()',
  str_times_float: 'Текст × дробное число',
  input_without_int: 'Забыт int() после input()',
  bad_int_input: 'int() от нечисла',
  bad_float_input: 'float() от нечисла (запятая?)',
  zero_division: 'Деление на ноль',
  indentation: 'Отступы',
  missing_colon: 'Нет двоеточия',
  assign_vs_compare: '= вместо ==',
  unclosed_string: 'Незакрытая кавычка',
  unbalanced_parens: 'Скобки не парные',
  missing_comma: 'Нет запятой в print()',
  syntax: 'Синтаксическая ошибка',
  too_many_inputs: 'Лишний input()',
  infinite_loop: 'Бесконечный цикл',
  import: 'Лишний import',
  hardcoded_output: 'Ответ вписан в print',
  off_by_one_range: 'Ошибка на единицу в range',
  other: 'Другая ошибка',
};

export const errorTagRu = (tag: string) => ERROR_TAG_RU[tag] ?? tag;
