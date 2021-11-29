import { Component, OnInit } from '@angular/core';
import { AlertController, NavController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { DatabaseService } from '../services/database.service';
import { LoadingService } from '../services/loading.service';
import { File } from '@ionic-native/file/ngx';
import { ActivatedRoute } from '@angular/router';
import { PhotoViewer } from '@ionic-native/photo-viewer/ngx';

@Component({
  selector: 'app-media',
  templateUrl: './media.page.html',
  styleUrls: ['./media.page.scss'],
})
export class MediaPage implements OnInit {

  medias: any[] = [];

  type: any;

  constructor(
    private file: File,
    public navCtrl: NavController,
    private alertCtrl: AlertController,
    public loading: LoadingService,
    public translate: TranslateService,
    private photoViewer: PhotoViewer,
    private activatedRoute: ActivatedRoute,
    private db: DatabaseService
  ) { }

  ngOnInit() {
    this.activatedRoute.paramMap.subscribe(param => {
      this.type = param.get('type');

      this.db.loadPurchasePicturesTypes(this.type).then(() => {
        this.db.getPurchasePictures().subscribe(data => { 
          this.medias = [];
          this.medias = data;
        });
      });
    });
  }

  async presentAlert(message, title) {
    const alert = await this.alertCtrl.create({
      message: message,
      subHeader: title,
      buttons: ['OK']
    });
    alert.present();
  }

  ionRefresh(event) {
    console.log('Pull Event Triggered!');
    setTimeout(() => {
      console.log('Async operation has ended');
      this.ngOnInit();
      //complete()  signify that the refreshing has completed and to close the refresher
      event.target.complete();
    }, 2000);
  }

  ionPull(event) {
    //Emitted while the user is pulling down the content and exposing the refresher.
    console.log('ionPull Event Triggered!' + event);
  }

  ionStart(event) {
    //Emitted when the user begins to start pulling down.
    console.log('ionStart Event Triggered!' + event);
  }

  async deleteConfirm(item) {
    var yes, no, title, msg;
    this.translate.get('YES').subscribe(value => { yes = value; });
    this.translate.get('NO').subscribe(value => { no = value; });
    this.translate.get('DELETE_MEDIA_PP_TITLE').subscribe(value => { title = value; });
    this.translate.get('DELETE_MEDIA_PP_MSG').subscribe(value => { msg = value; });

    const alert = await this.alertCtrl.create({
      message: msg + item.filename + '?',
      subHeader: title,
      buttons: [
        {
          text: no,
          handler: data => {
            console.log(data);
          }
        },
        {
          text: yes,
          handler: data => {
            console.log(data);
            this.deleteMedia(item.id_doc, item.filename);
          }
        }
      ]
    });
    alert.present();
  }

  deleteMedia(id_doc, filename) {
    this.db.deletePurchaseDoc(id_doc).then(_ => {
      let correctPath = this.file.externalDataDirectory + 'warehouse_photos/' + filename;

      this.file.removeFile(correctPath, filename).then(() => {
        this.translate.get('DOCUMENT_DELETE_SUCCESS').subscribe(value => {
          this.presentAlert(value, 'Success');
        });
      })
    });
  }

  showMedia(item) {
    var correctPath;
    if (item.cloud_path != null) {
      correctPath = item.cloud_path;
    } else {
      correctPath = this.file.externalDataDirectory + 'warehouse_photos/' + item.filename;
    }

    this.photoViewer.show(correctPath);
  }

  back() {
    this.navCtrl.navigateBack(['/tabs/home']);
  }

}
