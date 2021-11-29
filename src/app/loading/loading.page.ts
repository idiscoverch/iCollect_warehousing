import { Component, OnInit } from '@angular/core';
import { HTTP } from '@ionic-native/http/ngx';
import { AlertController, ToastController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { LoadingService } from '../services/loading.service';
import { NetworkService, ConnectionStatus } from '../services/network.service';
import { Geolocation } from '@ionic-native/geolocation/ngx';
import { DatabaseService } from '../services/database.service';

@Component({
  selector: 'app-loading',
  templateUrl: './loading.page.html',
  styleUrls: ['./loading.page.scss'],
})
export class LoadingPage implements OnInit {

  scheduleList: any = [];
  warehouseList: any = [];
  palettesList: any = [];

  id_ord_schedule: any;
  person_name: any;
  nr_containers: any;
  weight_shipment: any;
  month_etd: any;
  warehouse_id: any;
  palette_id: any;
  tare: any;
  net_weight: any;
  weight: any;
  palette_code: any;
  id_company: any;

  shp_details = false;
  palettes = false;
  palette_details = false;
  enable_save = true;

  network: any;
  id_agent: any;
  coordx: any;
  coordy: any;

  constructor(
    public http: HTTP,
    public loading: LoadingService,
    public translate: TranslateService,
    private networkService: NetworkService,
    private alertCtrl: AlertController,
    private toastController: ToastController,
    private geolocation: Geolocation,
    private db: DatabaseService
  ) { }

  ngOnInit() {
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

  loadData() {
    this.translate.get('LOADING').subscribe(value => {
      this.loading.showLoader(value);
    });

    this.scheduleList = [];
    this.http.get('https://factory.icertification.ch/ords/icoop/v_order_schedule/', {}, {}).then(data => {
      let rows = JSON.parse(data.data);

      rows.items.forEach(value => {
        this.scheduleList.push({
          id_ord_schedule: value.id_ord_schedule,
          supplier_reference_nr: value.supplier_reference_nr
        });
      });
    });

    this.warehouseList = [];
    this.http.get('https://factory.icertification.ch/ords/icoop/wh_stock_v/', {}, {}).then(data => {
      let rows = JSON.parse(data.data);

      rows.items.forEach(value => {
        this.warehouseList.push({
          warehouse_id: value.warehouse_id,
          warehouse_name: value.warehouse_name
        });
      });
    });

    this.db.lastLogedUser().then(usr => {
      this.id_agent = usr.id_contact;
    });

    this.loading.hideLoader();
  }

  checkSchedule() {
    this.shp_details = true;
    this.http.get('https://factory.icertification.ch/ords/icoop/v_order_schedule/?q={%22id_ord_schedule%22:%22' + this.id_ord_schedule + '%22}', {}, {}).then(data => {
      let rows = JSON.parse(data.data);

      this.person_name = rows.items[0].person_name;
      this.nr_containers = rows.items[0].nr_containers;
      this.weight_shipment = rows.items[0].weight_shipment;
      this.month_etd = rows.items[0].month_etd;
    });
  }

  checkWarehouse() {
    this.palettes = true;

    this.palettesList = [];
    this.http.get('https://factory.icertification.ch/ords/icoop/wh_palette/?q={%22warehouse_id%22:%22'+this.warehouse_id+'%22}', {}, {}).then(data => {
      let rows = JSON.parse(data.data);

      rows.items.forEach(value => {
        this.palettesList.push({
          palette_id: value.palette_id,
          palette_code: value.palette_code
        });
      });
    });
  }

  checkPalette() {
    this.palette_details = true;

    this.http.get('https://factory.icertification.ch/ords/icoop/wh_palette/?q={%22palette_id%22:%22' + this.palette_id + '%22}', {}, {}).then(data => {
      let rows = JSON.parse(data.data);

      this.palette_code = rows.items[0].palette_code;
      this.id_company = rows.items[0].id_company;
      this.tare = rows.items[0].tare;
    });
  }

  checkBeforeSave() {
    if (this.tare != null && this.weight != null) {
      this.enable_save = false;
      this.net_weight = (this.weight - this.tare);
    } else { this.enable_save = true; }
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
          //ID_PRODUCT: this.id_product,
          //PALETTE_NR_OF_BAGS: this.palette_nr_of_bags,
          PALETTE_NUMBER: this.palette_code,
          ID_AGENT: this.id_agent,
          WEIGHT: this.net_weight,
          ID_PACKAGE_TYPE: 805,
          WEIGHT_UNIT: 568,
          FROM_WAREHOUSE_ID: this.warehouse_id,
          TO_WAREHOUSE_ID: 6,
          WAREHOUSE_ID: 6,
          WAREHOUSE_TYPE_ID: 863,
          //WH_ZONE_ID: get.wh_zone_id,
          //WH_ZONE_ID :this.WH_ZONE_ID
          //FROM_ZONE_ID:GET.ZONE_ID
          //TO_ZONE_ID: this.WH_ZONE_ID
          TRANSACTION_WEIGHT_DETAILS_TYP: 945,
          //PRODUCT_QUALITY: this.product_quality,
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
  
            this.enable_save = true;
            this.net_weight = null;
            this.palette_details = false;
            this.palettes = false;
            this.shp_details = false;
  
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
