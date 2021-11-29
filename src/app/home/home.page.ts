import { Component, OnInit } from '@angular/core';
import { HTTP } from '@ionic-native/http/ngx';
import { AlertController, NavController, ToastController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { DatabaseService } from '../services/database.service';
import { LoadingService } from '../services/loading.service';
import { NetworkService, ConnectionStatus } from '../services/network.service';
import { Camera, CameraOptions, PictureSourceType } from '@ionic-native/camera/ngx';
import { Geolocation } from '@ionic-native/geolocation/ngx';
import { File } from '@ionic-native/file/ngx';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit {

  productList: any = [];
  porductQualityList: any = [];
  palettes: any = [];
  warehouseList: any = [];
  zoneList: any = [];

  network: any;
  id_agent: any;
  coordx: any;
  coordy: any;

  palette_id: any;
  palette_code: any;
  id_company: any;
  warehouse_id: any;
  warehouse_data: any;
  tare: any;

  product_quality: any;
  id_product: any;
  weight: any;
  palette_nr_of_bags: any;
  net_weight: any;
  enable_save: any;
  wh_zone_id: any;
  wh_type_id: any;

  isPhoto = true;
  part2 = false;

  isProduct = false;
  isProductQuality = false;
  isPalette = false;
  isNrOfBags = false;
  isWeight = false;

  constructor(
    public http: HTTP,
    public camera: Camera,
    public loading: LoadingService,
    public translate: TranslateService,
    private networkService: NetworkService,
    private alertCtrl: AlertController,
    private toastController: ToastController,
    private geolocation: Geolocation,
    public navCtrl: NavController,
    private db: DatabaseService,
    private file: File
  ) { }

  ngOnInit() {
    this.db.getDatabaseState().subscribe(ready => {
      if (ready) {
        console.log(ready);
        this.db.checkLogin().then(data => {
          if (data.total == 0) {
            this.navCtrl.navigateRoot(['/language']);
          }
        });
      }
    });

    this.networkService.onNetworkChange().subscribe((status: ConnectionStatus) => {
      if (status == ConnectionStatus.Online) {
        this.network = true;
        this.loadData();

        this.geolocation.getCurrentPosition().then((resp) => {
          this.coordx = resp.coords.latitude;
          this.coordy = resp.coords.longitude;
        });
      }

      if (status == ConnectionStatus.Offline) {
        this.network = false;
      }
    });
  }

  checkBeforeSave() {
    if (this.tare != null && this.weight != null) {
      this.enable_save = false;
      this.net_weight = (this.weight - this.tare);
    } else { this.enable_save = true; }
  }

  loadData() {
    this.translate.get('LOADING').subscribe(value => {
      this.loading.showLoader(value);
    });

    this.productList = [];
    this.db.loadProducts().then(() => {
      this.db.getProducts().subscribe(data => {
        this.productList = data;
      });
    });

    this.porductQualityList = [];
    this.db.loadProductsQuality().then(() => {
      this.db.getProductsQuality().subscribe(data => {
        this.porductQualityList = data;
      });
    });


    this.palettes = [];
    this.http.get('https://factory.icertification.ch/ords/icoop/v_unused_palette/?warehouse_id=2&limit=1000&q={%22$orderby%22:{%22palette_code%22:%22asc%22}}', {}, {}).then(data => {
      let rows = JSON.parse(data.data);

      rows.items.forEach(value => {
        this.palettes.push({
          palette_id: value.palette_id,
          palette_code: value.palette_code,
          id_company: value.id_company
        });
      });
    });

    this.db.lastLogedUser().then(usr => {
      this.id_agent = usr.id_contact;
    });

    this.loading.hideLoader();
  }

  loadPaletteData(palette_id) {
    this.isPhoto = false;
    this.http.get('https://factory.icertification.ch/ords/icoop/wh_palette/?q={%22palette_id%22:%22' + palette_id + '%22}', {}, {}).then(data => {
      let rows = JSON.parse(data.data);

      this.palette_id = palette_id;
      this.palette_code = rows.items[0].palette_code;
      this.id_company = rows.items[0].id_company;
      this.warehouse_id = rows.items[0].warehouse_id;
      this.tare = rows.items[0].tare;
    });

    this.checkBeforeSave();
  }

  savePhoto() {
    this.takePicture(this.camera.PictureSourceType.CAMERA);
  }

  takePicture(sourceType: PictureSourceType) {
    var options: CameraOptions = {
      quality: 100,
      targetWidth: 900,
      targetHeight: 900,
      sourceType: sourceType,
      saveToPhotoAlbum: false,
      correctOrientation: true,
      destinationType: this.camera.DestinationType.FILE_URI,
      encodingType: this.camera.EncodingType.JPEG,
      mediaType: this.camera.MediaType.PICTURE
    };

    this.camera.getPicture(options).then(imagePath => {
      var currentName = imagePath.substr(imagePath.lastIndexOf('/') + 1);
      var correctPath = imagePath.substr(0, imagePath.lastIndexOf('/') + 1);

      var m = new Date();
      let created_date = m.getUTCFullYear() + "-" + ("0" + (m.getUTCMonth() + 1)).slice(-2) + "-" + ("0" + m.getUTCDate()).slice(-2) + "_" + ("0" + m.getUTCHours()).slice(-2) + "-" + ("0" + m.getUTCMinutes()).slice(-2) + "-" + ("0" + m.getUTCSeconds()).slice(-2);

      var newFileName = this.id_agent + '_957_ ' + created_date + ".jpg";
      let newPath =  this.file.externalDataDirectory + 'warehouse_photos/';

      var description;
      if(this.part2 == true) {
        description = 'PHOTO Part2 of the Zone/LOT';
      } else { description = 'PHOTO Part 1 of Weight Indicator LED'; }

      this.file.moveFile(correctPath, currentName, newPath, newFileName).then(_ => {
        this.db.saveDocData(this.id_agent, null, newFileName, description, 957, null);
        this.presentAlert('Photo enregistré avec succè', 'Successs');
      });
    });
  }
 
  save_weihgt() {
    if (this.network == true) {
      this.loading.showLoader('Envoi au serveur...');

      var m = new Date();
      let created_date = m.getUTCFullYear() + "-" + ("0" + (m.getUTCMonth() + 1)).slice(-2) + "-" + ("0" + m.getUTCDate()).slice(-2) + " " + ("0" + m.getUTCHours()).slice(-2) + ":" + ("0" + m.getUTCMinutes()).slice(-2) + ":" + ("0" + m.getUTCSeconds()).slice(-2);

      var link = 'https://factory.icertification.ch/ords/icoop/wh/purchaseweight/';

      this.http.get('https://factory.icertification.ch/ords/icoop/v_max_purchase_transaction_id/', {}, {}).then(data => {
        let rows = JSON.parse(data.data);
        var wh_purchase_transaction_id = rows.items[0].wh_purchase_transaction_id;

        var myData = JSON.stringify({
          WH_PURCHASE_TRANSACTION_ID: wh_purchase_transaction_id,
          ID_PALETTE: this.palette_id,
          ID_PRODUCT: this.id_product,
          PALETTE_NR_OF_BAGS: this.palette_nr_of_bags,
          PALETTE_NUMBER: this.palette_code,
          ID_AGENT: this.id_agent,
          WEIGHT: this.net_weight,
          ID_PACKAGE_TYPE: 805,
          WEIGHT_UNIT: 568,
          WAREHOUSE_ID: 8,
          TRANSACTION_WEIGHT_DETAILS_TYP: 879,
          //PRODUCT_QUALITY: this.product_quality,
          PRODUCT_QUALITY: 947,
          WAREHOUSE_TYPE_ID: 852,
          ID_COMPANY: this.id_company,
          COORDY: this.coordx,
          COORDX: this.coordy,
          CREATED: created_date,
          CREATED_BY: this.id_agent
        });
  
        this.http.setDataSerializer('utf8');
        this.http.post(link, myData, {})
          .then(() => { 
            this.loading.hideLoader();
            this.toastAlert('Données chargés avec succès.');
  
            this.isProduct = true;
            this.isProductQuality = true;
            this.isPalette = true;
            this.isNrOfBags = true;
            this.isWeight = true;

            this.part2 = true;
            this.enable_save = true;
            this.loadPart2_details();
  
          }).catch((error) => {
            this.loading.hideLoader();
            this.presentAlert('Echec du trasfert au serveur', 'Erreur');
  
            console.error('API Error : ', error.status);
            console.error('API Error : ', JSON.stringify(error));
          });
      });

    } else {
      this.toastAlert('Vérifier votre connexion à internet');
    }
  }

  loadPart2_details() {
    this.http.get('https://factory.icertification.ch/ords/icoop/v_warehouse/?q?%7b%22id_company:15064%22%7d', {}, {}).then(data => {
      let rows = JSON.parse(data.data);

      rows.items.forEach(value => {
        this.warehouseList.push({
          warehouse_id: value.warehouse_id,
          warehouse_name: value.warehouse_name,
          warehouse_data: value.warehouse_id+'@@'+value.wh_type_id,
          wh_type_id: value.wh_type_id
        });
      });
    });

    this.http.get('https://factory.icertification.ch/ords/icoop/wh_zone/', {}, {}).then(data => {
      let rows = JSON.parse(data.data);

      rows.items.forEach(value => {
        this.zoneList.push({
          wh_zone_id: value.wh_zone_id,
          zone_name: value.zone_name
        });
      });
    });

  }

  save_zone() {
    if (this.network == true) {
      this.loading.showLoader('Envoi au serveur...');

      var donne = this.warehouse_data.split('@@');
      this.warehouse_id = donne[0];
      this.wh_type_id = donne[1];

      var m = new Date();
      let created_date = m.getUTCFullYear() + "-" + ("0" + (m.getUTCMonth() + 1)).slice(-2) + "-" + ("0" + m.getUTCDate()).slice(-2) + " " + ("0" + m.getUTCHours()).slice(-2) + ":" + ("0" + m.getUTCMinutes()).slice(-2) + ":" + ("0" + m.getUTCSeconds()).slice(-2);

      var link = 'https://factory.icertification.ch/ords/icoop/wh/purchaseweight/';

      this.http.get('https://factory.icertification.ch/ords/icoop/v_max_purchase_transaction_id/', {}, {}).then(data => {
        let rows = JSON.parse(data.data);
        var wh_purchase_transaction_id = rows.items[0].wh_purchase_transaction_id;

        var myData = JSON.stringify({
          WH_PURCHASE_TRANSACTION_ID: wh_purchase_transaction_id,
          ID_PALETTE: this.palette_id,
          ID_PRODUCT: this.id_product,
          PALETTE_NR_OF_BAGS: this.palette_nr_of_bags,
          PALETTE_NUMBER: this.palette_code,
          ID_AGENT: this.id_agent,
          WEIGHT: this.net_weight,
          ID_PACKAGE_TYPE: 805,
          WEIGHT_UNIT: 568,
          FROM_WAREHOUSE_ID: 8,
          TO_WAREHOUSE_ID: this.warehouse_id,
          WAREHOUSE_ID: this.warehouse_id,
          TRANSACTION_WEIGHT_DETAILS_TYP: 880,
          PRODUCT_QUALITY: this.product_quality,
          WAREHOUSE_TYPE_ID: this.wh_type_id,
          ID_COMPANY: this.id_company,
          WH_ZONE_ID: this.wh_zone_id,
          COORDY: this.coordx,
          COORDX: this.coordy,
          CREATED: created_date,
          CREATED_BY: this.id_agent,
          FROM_ZONE_ID: 84,
          TO_ZONE_ID: this.wh_zone_id
        });
  
        this.http.setDataSerializer('utf8');
        this.http.post(link, myData, {})
          .then(() => {
            this.loading.hideLoader();
            this.toastAlert('Données chargés avec succès.');
  
            this.part2 = false;
            this.enable_save = false;
  
            this.weight = null;
            this.tare = null;
            this.palette_nr_of_bags = null;

            //this.id_product = null;
            //this.product_quality = null;
            this.palette_id = null;

            this.isProduct = false;
            this.isProductQuality = false;
            this.isPalette = false;
            this.isNrOfBags = false;
            this.isWeight = false;

            this.isPhoto = true;
            this.loadData(); 
  
          }).catch((error) => {
            this.loading.hideLoader();
            this.presentAlert('Echec du trasfert au serveur', 'Erreur');
  
            console.error('API Error : ', error.status);
            console.error('API Error : ', JSON.stringify(error));
          });
      });

    } else {
      this.toastAlert('Vérifier votre connexion à internet');
    }
  }

    media(type) {
      let data = {
        type: type
      }
  
      this.navCtrl.navigateForward(['/media', data]);
    }
  
  async toastAlert(message) {
    let toast = this.toastController.create({
      message: message,
      duration: 1500,
      position: 'bottom'
    });
    toast.then(toast => toast.present());
  }

  async presentAlert(message, title) {
    const alert = await this.alertCtrl.create({
      message: message,
      subHeader: title,
      buttons: ['OK']
    });
    alert.present();
  }

}
