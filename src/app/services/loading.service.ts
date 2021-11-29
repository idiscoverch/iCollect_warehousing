import { Injectable } from '@angular/core';
import { LoadingController } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {

  isLoading = false;

  constructor(public loadingController: LoadingController) {}

  async showLoader(content) {
    this.isLoading = true;
    return await this.loadingController.create({
      message: content
    }).then((res) => {
      res.present();
 
      res.onDidDismiss().then((dis) => {
        console.log('Loading dismissed!');
      });

      if (!this.isLoading) {
        this.hideLoader();
      }
    }); 
  }

  async hideLoader() {
    this.isLoading = false;
    return await this.loadingController.dismiss();
  }

}
