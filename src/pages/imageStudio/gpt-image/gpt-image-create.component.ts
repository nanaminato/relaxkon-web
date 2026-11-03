import {Component, inject} from '@angular/core';
import {Gallery} from "../gallery/gallery";
import {TranslateModule} from "@ngx-translate/core";
import {GptImageCreateRequest, GptImageResponse, TaskImage, UrlImage} from "../../../models/images";
import {NzButtonComponent} from "ng-zorro-antd/button";
import {NzIconDirective} from "ng-zorro-antd/icon";
import {MenuAbleService} from "../../../services/normal-services/menu-able.service";
import {NzNotificationService} from "ng-zorro-antd/notification";
import {UniversalService} from "../../../services/db-services/universal.service";
import {AuthService, SendManagerService} from "../../../auth_module";
import {FormsModule} from "@angular/forms";
import {NzInputNumberComponent} from "ng-zorro-antd/input-number";
import {NzSliderComponent} from "ng-zorro-antd/slider";
import {NzInputDirective} from "ng-zorro-antd/input";
import {OpenaiService} from "../../../services/fetch_services";
import {NzOptionComponent, NzSelectComponent} from "ng-zorro-antd/select";
import {LocalizationService, SizeReportService} from "../../../services/normal-services";
import {NzWaveDirective} from "ng-zorro-antd/core/wave";
import {CdkTextareaAutosize} from "@angular/cdk/text-field";
import {GenerateTask} from "../../../models/media";

@Component({
  selector: 'app-dalle',
  templateUrl: './gpt-image-create.component.html',
  styleUrls: ['./gpt-image-create.component.scss'],
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
    CdkTextareaAutosize
  ]
})
export class GptImageCreate{

  constructor(private menuAbleService: MenuAbleService,
              private notification: NzNotificationService,
              private universalService: UniversalService,
              private openaiService: OpenaiService,
              private authService: AuthService,
              private sendService: SendManagerService) {
    this.menuAbleService.enableImage();

  }
  images: UrlImage[] | undefined = [];
  loading: boolean = false;
  image_num: number = 1;
  image_num_max: number = 1;
  model: string = "dall-e-3";
  prompt: string = "";
  // n: number = 1; image_num
  size: string = "1024x1024";
  quality: string = "standard";
  style: string = "vivid";
  response_format: string = "url";
  background: string = "auto";
  moderation: string = "auto";
  output_format: string = "png";

  //gpt-image only
  backgrounds: string[] = [
    "transparent",
    "opaque",
    "auto"
  ]
  //gpt-image only
  moderations: string[] = [
    "low",
    "auto"
  ]
  output_formats: string[] = [
    "png","jpeg","webp"
  ]
  //dall3
  qualities: string[] = [
    "hd","standard"
  ];
  image_response_formats: string[] = [
    "url",
    "b64_json"
  ];
  //dalle3
  sizes: string[] = [
    "1024x1024",
    "1024x1792",
    "1792x1024"
  ];
  //dall3
  styles: string[] = [
    "vivid","natural"
  ];

  async generateImages() {
    this.loading = true;
    let result :GptImageResponse | undefined;
    try{
      let createRequest: GptImageCreateRequest = {
        model: this.model,
        prompt: this.prompt,
        n: this.image_num,
        size: this.size,
        quality: this.quality,
        moderation: this.moderation,
        output_format: this.output_format,
        response_format: this.response_format,
        style: this.style
      };
      if(createRequest.model!.startsWith("dall")){
        result = await this.openaiService.dallImageCreate(createRequest);
      }else{
        result = await this.openaiService.gptImageCreate(createRequest);
      }

    }catch (e:any){
      this.loading = false;
      this.notification.error(this.localization.text('notifications.generationFailed'), e.error)
      return;
    }
    if(result===null||result.data===null ||result.data.length===0){
      this.loading = false;
      this.notification.error(this.localization.text('notifications.generationFailed'), '')
      return;
    }
    this.loading = false;
    this.images!.length = 0;
    result.data.forEach(image=>{
      this.images?.push({
        image_url: this.getImageUrl(image),
        image_url_ttl: "3600",
        image_type: "any"
      })
    });
    let task: GenerateTask = {
      task_id: Date.now()+'',
      account_id: this.authService.user!.id!,
      task_type: "any => image",
      images: result.data.map(f=> this.getImageUrl(f)),
      date: new Date(),
    };
    await this.universalService.addOrUpdateGenerateTask(task);
    await this.sendService.sendTask(task)
  }
  sizeReportService: SizeReportService = inject(SizeReportService);
  private localization = inject(LocalizationService);
  menuVisible() {
    return this.sizeReportService.menuVisible;
  }

  toggleMenu() {
    this.sizeReportService.toggleMenu()
  }
  getImageUrl(image: any): string {
    if (image.url && image.url.length > 0) {
      return image.url;
    }
    if (image.b64Json) {
      if (image.b64Json.startsWith('data:image/')) {
        return image.b64Json;
      }
      return `data:image/png;base64,${image.b64Json}`;
    }
    return '';
  }
  //妯″瀷鍒囨崲
  protected modelChange(event: string) {
    if(this.model.startsWith("dall")){
      if(this.model==="dall-e-3"){
        this.sizes = [
          "1024x1024",
          "1024x1792",
          "1792x1024"
        ];
        this.qualities = ["auto","hd","standard"];
      }else if(this.model==="dall-e-2"){
        this.sizes = [
          "256x256",
          "512x512",
          "1024x1024"
        ];
        this.qualities = ["auto","standard"];
      }
    }else{
      this.sizes = [
        "1024x1024",
        "1024x1536",
        "1536x1024",
        "auto"
      ];
      this.qualities = ["auto","high","medium","low"];
    }
    this.size = this.sizes[0];
    this.quality = this.qualities[0];
    if(this.model==="dall-e-3"){
      this.image_num_max = 1;
      this.image_num = 1;
    }else{
      this.image_num_max = 10;
    }
  }
}
