import { Component, ElementRef, HostListener } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDatepicker, MatDatepickerModule } from '@angular/material/datepicker';
import * as _moment from 'moment';
import { default as _rollupMoment, Moment } from 'moment';
import moment from 'moment';
import sv from '@angular/common/locales/sv';
import { registerLocaleData } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';

type Calculation = {
  amount: number;
  from: Moment;
  through: Moment
  result: number;
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  public isHandset = window.matchMedia('(max-width: 599px)').matches;
  public minDate = moment('1980-01-01');
  public maxDate = moment().subtract(2, 'months');
  public amount: number | null = null;
  public from: Moment | null = null;
  public through: Moment | null = null;
  public isLoading = false;
  public calculation: Calculation | null = null;

  constructor(
    private http: HttpClient,
    private elementRef: ElementRef<HTMLElement>
  ) {
    moment.locale('sv');
    registerLocaleData(sv);
    this.loadAvailableDateRange();
  }

  private async loadAvailableDateRange() {
    const url = 'https://api.scb.se/OV0104/v1/doris/sv/ssd/START/PR/PR0101/PR0101A/KPItotM';
    const metadata = await lastValueFrom(this.http.get(url)) as any;
    const tid = metadata.variables.find((v: any) => v.code === 'Tid');
    this.minDate = moment(tid.values.at(0), 'YYYY[M]MM');
    this.maxDate = moment(tid.values.at(-1), 'YYYY[M]MM');
  }

  public openDatepicker(event: Event, datepickerRef: MatDatepicker<Moment>) {
    event.preventDefault();
    datepickerRef.open();
  }

  public setFromMonthAndYear(normalizedMonthAndYear: Moment, datepickerRef: MatDatepicker<Moment>) {
    this.from = moment(normalizedMonthAndYear);
    datepickerRef.close();
  }

  public setThroughMonthAndYear(normalizedMonthAndYear: Moment, datepickerRef: MatDatepicker<Moment>) {
    this.through = moment(normalizedMonthAndYear);
    datepickerRef.close();
  }

  public isFormValid() {
    if (this.amount === null) {
      return false;
    }

    if (this.amount === 0) {
      return false;
    }

    if (this.from === null) {
      return false;
    }

    if (this.through === null) {
      return false;
    }

    return true;
  }

  public async handleSubmit() {
    this.isLoading = true;
    this.calculation = null;

    const amount = this.amount!;
    const from = this.from!;
    const through = this.through!;

    if (from.isSame(through, 'month')) {
      this.calculation = {
        amount: amount,
        from: from,
        through: through,
        result: Math.round(amount)
      };
    } else {
      const response = await this.sendRequest(from, through);
      const fromCpi = response.data.at(0).values.at(0) as number;
      const throughCpi = response.data.at(1).values.at(0) as number;

      this.calculation = {
        amount: amount,
        from: from,
        through: through,
        result: Math.round(this.getResult(amount, from, fromCpi, through, throughCpi))
      };
    }

    this.isLoading = false;

    setTimeout(() => {
      this.elementRef.nativeElement.scrollTo({
        top: this.elementRef.nativeElement.scrollHeight,
        behavior: 'smooth'
      });
    }, 1);
  }

  private async sendRequest(from: Moment, through: Moment) {
    const url = 'https://api.scb.se/OV0104/v1/doris/sv/ssd/START/PR/PR0101/PR0101A/KPItotM';
    const body = {
      query: [
        {
          code: "ContentsCode",
          selection: {
            filter: "item",
            values: [
              "000004VU"
            ]
          }
        },
        {
          code: "Tid",
          selection: {
            filter: "item",
            values: [
              `${from.format('YYYY')}M${from.format('MM')}`,
              `${through.format('YYYY')}M${through.format('MM')}`
            ]
          }
        }
      ],
      response: {
        format: "json"
      }

    };
    const headers = { 'Content-Type': 'text/plain' }
    const request = this.http.post(url, JSON.stringify(body), { headers: headers });
    const response = await lastValueFrom(request) as any;

    return response;
  }

  private getResult(amount: number, from: Moment, fromCpi: number, through: Moment, throughCpi: number) {
    let result: number;

    if (from < through) {
      result = amount * (throughCpi / fromCpi);
    } else if (from > through) {
      result = amount * (fromCpi / throughCpi);
    } else {
      result = amount;
    }

    return result;
  }

  @HostListener('window:resize', ['$event'])
  handleResize() {
    this.isHandset = window.matchMedia('(max-width: 599px)').matches;
  }
}
