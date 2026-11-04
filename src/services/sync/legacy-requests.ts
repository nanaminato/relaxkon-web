import type {ChatHistoryTitle, ChatInterface} from '../../models';
import type {GenerateTask} from '../../models/media';
import type {HistoryWriteRequest, MessageWriteRequest, TaskWriteRequest} from '../../contracts/sync';
export const historyRequest = (history: ChatHistoryTitle): HistoryWriteRequest => ({dataId: history.dataId, title: history.title});
export const messageRequest = (historyId: number, message: ChatInterface): MessageWriteRequest => ({
  historyDataId: historyId, dataId: message.dataId, role: message.role, content: message.content, finish: message.finish,
  model: message.model, fileList: message.fileList?.map(file => ({fileName: file.fileName, fileType: file.fileType,
    fileSize: file.fileSize ?? 0, fileContent: file.fileContent, parsedContent: file.parsedContent}))
});
export const taskRequest = (task: GenerateTask): TaskWriteRequest => {
  if (!task.task_id) throw new Error('A task ID is required');
  return {task_id: task.task_id, task_type: task.task_type, date: task.date instanceof Date ? task.date.toISOString() : task.date,
    images: task.images, videos: task.videos};
};
