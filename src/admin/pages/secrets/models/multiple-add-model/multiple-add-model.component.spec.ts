import {TestBed} from '@angular/core/testing';
import {TranslateService} from '@ngx-translate/core';
import {of, throwError, Subject} from 'rxjs';
import {MultipleAddModelComponent} from './multiple-add-model.component';
import {KeyCallService} from '../../../../services';
import {NzMessageService} from 'ng-zorro-antd/message';

describe('Model example batch import', () => {
  function setup() {
    const call = {addModel: jasmine.createSpy('addModel').and.returnValue(of(null))};
    const message = {success: jasmine.createSpy('success'), error: jasmine.createSpy('error')};
    TestBed.configureTestingModule({providers: [{provide: TranslateService, useValue: {instant: (key: string) => key}}]});
    const component = TestBed.runInInjectionContext(() => new MultipleAddModelComponent(message as unknown as NzMessageService, call as unknown as KeyCallService));
    component.availableModels = [{name: 'One', modelValue: 'one', isChatModel: true, vision: true}, {name: 'Two', modelValue: 'two', isChatModel: true, vision: true}];
    component.selects = [true, true];
    return {component, call, message};
  }
  it('recognizes configured model IDs even when display names differ', () => {
    const {component} = setup(); component.existModels = [{name: 'Custom label', modelValue: 'one', isChatModel: true, vision: true}];
    component.selectAll(); expect(component.selects).toEqual([false, true]);
  });
  it('closes once after the whole batch succeeds and prevents duplicate submission', async () => {
    const {component, call} = setup(); const wait = new Subject<null>(); call.addModel.and.returnValue(wait);
    const closed = spyOn(component.close, 'emit'); const pending = component.addModels();
    await component.addModels(); expect(call.addModel).toHaveBeenCalledTimes(1);
    wait.next(null); await Promise.resolve(); await Promise.resolve(); wait.next(null); wait.complete();
    await pending; expect(call.addModel).toHaveBeenCalledTimes(2); expect(closed).toHaveBeenCalledOnceWith(true);
  });
  it('retains successes and retries only failures after a partial batch error', async () => {
    const {component, call, message} = setup(); const closed = spyOn(component.close, 'emit');
    call.addModel.and.callFake(value => value.modelValue === 'two' ? throwError(() => new Error('failed')) : of(null));
    await component.addModels(); expect(component.selects).toEqual([false, true]); expect(closed).not.toHaveBeenCalled();
    expect(message.error).toHaveBeenCalled(); call.addModel.and.returnValue(of(null));
    await component.addModels(); expect(call.addModel).toHaveBeenCalledTimes(3); expect(closed).toHaveBeenCalledOnceWith(true);
  });
});
