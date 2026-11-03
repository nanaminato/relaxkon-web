import {Component, inject,  signal} from '@angular/core';
import {Gallery} from "../gallery/gallery";
import {TranslateModule} from "@ngx-translate/core";
import {
  APIMartGPTImage2OfficialRequest,
  APIMartGPTImage2Request,
  APIMartGPTImage2Response, APIMartTaskResponse,
  TaskImage,
  UrlImage
} from "../../../models/images";
import {NzButtonComponent} from "ng-zorro-antd/button";
import {NzIconDirective} from "ng-zorro-antd/icon";
import {MenuAbleService} from "../../../services/normal-services/menu-able.service";
import {NzNotificationService} from "ng-zorro-antd/notification";
import {UniversalService} from "../../../services/db-services/universal.service";
import {AuthService, SendManagerService} from "../../../auth_module";
import {FormsModule} from "@angular/forms";
import {NzInputNumberComponent} from "ng-zorro-antd/input-number";
import {NzSliderComponent} from "ng-zorro-antd/slider";
import {NzInputDirective, NzInputGroupComponent, NzInputWrapperComponent} from "ng-zorro-antd/input";
import {NzOptionComponent, NzSelectComponent} from "ng-zorro-antd/select";
import {LocalizationService, SizeReportService} from "../../../services/normal-services";
import {NzWaveDirective} from "ng-zorro-antd/core/wave";
import {CdkTextareaAutosize} from "@angular/cdk/text-field";
import {ApimartService} from "../../../services/fetch_services/apimart.service";
import {GenerateTask} from "../../../models/media";
import {NzSwitchComponent} from "ng-zorro-antd/switch";
import {fileToBase64} from "../../../services/utils";
import {NzUploadComponent, NzUploadFile} from "ng-zorro-antd/upload";
import {NzMessageService} from "ng-zorro-antd/message";
import {NzImageService} from "ng-zorro-antd/image";
import {ImageTaskService} from "../../../services/fetch_services";

@Component({
  selector: 'app-dalle',
  templateUrl: './apimart-image.component.html',
  styleUrls: ['./apimart-image.component.scss'],
  standalone: true,
  imports: [
    Gallery,
    TranslateModule,
    NzButtonComponent,
    NzIconDirective,
    FormsModule,
    NzInputNumberComponent,
    NzSliderComponent,
    NzInputDirective,
    NzSelectComponent,
    NzOptionComponent,
    NzWaveDirective,
    CdkTextareaAutosize,
    NzSwitchComponent,
    NzUploadComponent,
  ],
  providers: [
    NzImageService,
  ]
})
export class APIMartImage{

  constructor(private menuAbleService: MenuAbleService,
              private notification: NzNotificationService,
              private universalService: UniversalService,
              private apimartService: ApimartService,
              private authService: AuthService,
              private msg: NzMessageService,
              private nzImageService: NzImageService,
              private sendService: SendManagerService,
              private imageTaskService: ImageTaskService,) {
    this.menuAbleService.enableImage();

  }
  images: UrlImage[] | undefined = [];
  loading: boolean = false;

  image_num: number = 1;
  //for gpt-image-2 1
  //for gpt-image-2-official 1~4
  image_num_max: number = 1;

  model: string = "gpt-image-2";
  models: string[] = [
    "gpt-image-2",
    "gpt-image-2-official",
  ]
  prompt: string = "";
  size: string = "1:1";
  sizes_normal: string[] = [
    "1:1",
    "3:2",
    "2:3",
    "4:3",
    "3:4",
    "5:4",
    "4:5",
    "16:9",
    "9:16",
    "2:1",
    "1:2",
    "21:9",
    "9:21"
  ]
  sizes = this.sizes_normal;
  resolution: string = "1k";
  resolutions: string[] = [
    "1k",
    "2k",
    "4k"
  ]
  //official only
  quality: string = "high";
  qualities: string[] = [
    "auto",
    "low",
    "medium",
    "high",
  ];
  //official only
  background: string = "auto";
  backgrounds: string[] = [
    "transparent",
    "opaque",
    "auto"
  ]
  //official only
  moderation: string = "low";
  moderations: string[] = [
    "low",
    "auto"
  ]
  //official only
  output_format: string = "png";
  output_formats: string[] = [
    "png","jpeg","webp"
  ]

  image_urls: string[] = [

  ]
  mask_url: string | undefined = undefined;
  tempImageUrl = '';
  tempMaskUrl = '';
  //gpt-image-2 only
  official_fallback: boolean = false;

  async generateImages() {
    this.loading = true;
    let asyncTask :APIMartGPTImage2Response | undefined;
    try{
      if(this.model.endsWith("official")){
        let createRequest: APIMartGPTImage2OfficialRequest = {
          model: this.model,
          prompt: this.prompt,
          size: this.size,
          resolution: this.resolution,
          quality: this.quality,
          background: this.background,
          moderation: this.moderation,
          output_format: this.output_format,
          n: this.image_num,
          image_urls: this.image_urls.length===0?null: this.image_urls,
          mask_url: this.mask_url,
        };
        asyncTask = await this.apimartService.gptImage2Official(createRequest);
      }else{
        let createRequest: APIMartGPTImage2Request = {
          model: this.model,
          prompt: this.prompt,
          n: this.image_num,
          size: this.size,
          resolution: this.resolution,
          image_urls: this.image_urls.length===0?null: this.image_urls,
          official_fallback: this.official_fallback,
        };
        asyncTask = await this.apimartService.gptImage2(createRequest);
      }
    }catch (e:any) {
      this.loading = false;
      this.notification.error(this.localization.text('notifications.generationFailed'), e.error)
      return;
    }
    if (asyncTask === undefined || asyncTask.code!==200) {
      this.loading = false;
      this.notification.error(this.localization.text('notifications.imageGenerationFailed'), '');
      return;
    }
    let task_id = asyncTask!.data![0]!.task_id!;
    let generateTask: GenerateTask = {
      task_id: task_id,
      account_id: this.authService.user!.id,
      date: new Date(),
      task_type: "apimart => image"
    };
    this.universalService.addOrUpdateGenerateTask(generateTask).then(t=>{
      this.notification.info(this.localization.text('notifications.taskCreated'), '');
      this.sendService.sendTask(generateTask);
    });
    this.imageTaskService.registerTask(task_id);

    let taskResult: APIMartTaskResponse | undefined;
    let first = true;
    while(taskResult===undefined ||
        (taskResult.data?.progress !== 100 ||taskResult.data.completed===0)
      ){
      if (!this.imageTaskService.isTaskRunning(task_id)) {
        console.log(`任务 ${task_id} 已在外部停止`);
        this.loading = false;
        return;
      }
      if(!first){
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      first = false;
      try{
        taskResult = await this.apimartService.getApiMartTask(task_id);
        if(taskResult.code===200){
          console.log("progress...",taskResult.data?.progress);
        }
      }catch (error: any){
        this.imageTaskService.unregisterTask(task_id);
        this.loading = false;
        this.notification.info(this.localization.text('notifications.taskResultFailed'), '');
        return;
      }
    }
    const resultData = taskResult?.data?.result?.images?.[0];
    const imageUrls: string[] = resultData?.url || [];
    const expiresAt = resultData?.expiresAt ?? '';

    generateTask.images = imageUrls;
    this.universalService.addOrUpdateGenerateTask(generateTask).then(() => {
      this.notification.info(this.localization.text('notifications.taskResultSaved'), '');
      this.sendService.updateTask(generateTask)
    });

    this.imageTaskService.unregisterTask(task_id);
    this.loading = false;

    this.images = imageUrls.map(url => ({
      image_url: url,
      image_url_ttl: String(expiresAt),
      image_type: "image",
    }));
  }
  sizeReportService: SizeReportService = inject(SizeReportService);
  private localization = inject(LocalizationService);
  menuVisible() {
    return this.sizeReportService.menuVisible;
  }

  toggleMenu() {
    this.sizeReportService.toggleMenu()
  }

  isOfficial = signal(false);
  //模型切换
  protected modelChange(event: string) {
    if(this.model.endsWith("official")){
      //gpt-image-2-official
      this.isOfficial.update(()=>true);
      this.image_num_max = 4;
    }else{
      //gpt-image-2
      this.isOfficial.update(()=>false);
      this.image_num_max = 1;
      this.image_num = 1;
    }

  }
  addUrlToList(): void {
    if (!this.tempImageUrl) return;
    if (this.image_urls.length >= 16) {
      this.msg.error(this.localization.text('notifications.referenceImageLimit'));
      return;
    }
    this.image_urls.push(this.tempImageUrl);
    this.tempImageUrl = '';
  }

  // 处理本地上传
  beforeImageUpload = (file: NzUploadFile): boolean => {
    if (this.image_urls.length >= 16) {
      this.msg.error(this.localization.text('notifications.referenceImageLimit'));
      return false;
    }

    this.handleLocalFile(file, 'list');
    return false; // 返回 false 停止上传流程
  };
  private async handleLocalFile(nzFile: NzUploadFile, type: 'list' | 'mask') {
    const file = nzFile as unknown as File;
    try {
      const base64 = await fileToBase64(file);
      if (type === 'list') {
        this.image_urls = [...this.image_urls, base64];
      } else {
        this.mask_url = base64;
      }
    } catch (e) {
      this.msg.error(this.localization.text('notifications.imageReadFailed'));
    }
  }
  removeImage(index: number): void {
    this.image_urls.splice(index, 1);
  }

  // --- 处理遮罩图 (mask_url) ---

  beforeMaskUpload = (file: NzUploadFile): boolean => {
    this.handleLocalFile(file, 'mask');
    return false; // 返回 false 停止上传流程
  };

  setMaskUrl(): void {
    if (this.tempMaskUrl) {
      this.mask_url = this.tempMaskUrl;
      this.tempMaskUrl = '';
    }
  }

  showImage(url: string) {
    const images = [
      {
        src: url,
        alt: 'preview'
      }
    ];
    this.nzImageService.preview(images);
  }
  highResolutionAvailableSize: string[] = [
    "16:9",
    "9:16",
    "2:1",
    "1:2",
    "21:9",
    "9:21"
  ]
  protected resolutionChange() {
    if(this.resolution==="4k" ){
      this.sizes = this.highResolutionAvailableSize;
      let index = this.highResolutionAvailableSize.indexOf(this.size);
      if(index > -1){

      }else{
        this.size = this.highResolutionAvailableSize[0];
        let sizes = this.highResolutionAvailableSize.join(", ")
        this.notification.warning(
          this.localization.text('notifications.imageRatioAdjusted'),
          this.localization.text('notifications.imageRatioAdjustedDescription', {sizes, size: this.size})
        )
      }
    }else{
      this.sizes = this.sizes_normal;
    }
  }

}
