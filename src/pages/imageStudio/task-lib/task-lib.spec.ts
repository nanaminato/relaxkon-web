import {TestBed} from '@angular/core/testing';
import {NzNotificationService} from 'ng-zorro-antd/notification';
import {TaskLib} from './task-lib';
import {UniversalService} from '../../../services/db-services/universal.service';
import {AuthService, RequestManagerService, SendManagerService} from '../../../auth_module';
import {LocalizationService, SizeReportService} from '../../../services/normal-services';
import {ImageTaskService} from '../../../services/fetch_services';

describe('Artwork library', () => {
  let component: TaskLib;
  beforeEach(() => {
    TestBed.configureTestingModule({providers: [
      {provide: SizeReportService, useValue: {}},
      {provide: UniversalService, useValue: {}},
      {provide: AuthService, useValue: {user: {id: 1}}},
      {provide: NzNotificationService, useValue: {}},
      {provide: RequestManagerService, useValue: {}},
      {provide: SendManagerService, useValue: {}},
      {provide: ImageTaskService, useValue: {}},
      {provide: LocalizationService, useValue: {text: (key: string) => key}}
    ]});
    component = TestBed.runInInjectionContext(() => new TaskLib());
    component.generateTasks = [
      {task_id: 'first', task_type: 'apimart => image', date: '2026-11-01', account_id: 1, images: ['a']},
      {task_id: 'second', task_type: 'any => image', date: '2026-11-05', account_id: 1, images: ['b', 'c']}
    ];
  });
  it('searches without changing source order or deleting the wrong sorted item', () => {
    expect(component.visibleTasks.map(task => task.task_id)).toEqual(['second', 'first']);
    component.search = ' APIMART ';
    expect(component.visibleTasks.map(task => task.task_id)).toEqual(['first']);
    expect(component.generateTasks.map(task => task.task_id)).toEqual(['first', 'second']);
    component.awareDeleteItem('first');
    component.search = '';
    expect(component.visibleTasks.map(task => task.task_id)).toEqual(['second']);
    expect(component.imageCount).toBe(2);
  });
  it('sorts oldest first and tolerates missing dates', () => {
    component.generateTasks.push({task_id: 'unknown', account_id: 1});
    component.sortOrder = 'oldest';
    expect(component.visibleTasks.map(task => task.task_id)).toEqual(['unknown', 'first', 'second']);
  });
});
