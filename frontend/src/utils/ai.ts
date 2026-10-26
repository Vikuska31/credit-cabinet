import type { AssistantResponse } from '../api/ai';

export function aiUnavailableMessage(reason?: string | null): string {
  switch (reason) {
    case 'OVERLOADED':
      return 'Помощник занят другим запросом. Дождитесь ответа и повторите попытку.';
    case 'TIMEOUT':
      return 'Помощник не успел ответить. Повторите запрос или продолжите оформление вручную.';
    case 'DISABLED':
      return 'Помощник отключён. Продолжите оформление вручную.';
    case 'INVALID_RESPONSE':
      return 'Не удалось разобрать ответ помощника. Уточните описание или продолжите вручную.';
    default:
      return 'Помощник временно недоступен. Повторите запрос позже или продолжите вручную.';
  }
}

export function assistantMessage(result: AssistantResponse): string {
  if (result.status === 'UNAVAILABLE') return aiUnavailableMessage(result.fallbackReason);
  if (result.clarifyingQuestion) return result.clarifyingQuestion;
  if (result.status === 'READY' && result.intent === 'UNKNOWN') {
    return 'Напишите, что вы хотите сделать: подобрать кредит, продолжить черновик, открыть заявку, посмотреть документ или узнать условия.';
  }
  if (result.status === 'READY' && result.intent === 'OUT_OF_SCOPE') {
    return 'Помощник отвечает на вопросы о бизнес-кредите и помогает работать с заявками и документами. Уточните ваш запрос.';
  }
  return result.reply;
}
