/*
 * Copyright (c) 2014-2023 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response, type NextFunction } from 'express'
import { ProductModel } from '../models/product'
import { BasketModel } from '../models/basket'
import challengeUtils = require('../lib/challengeUtils')

import * as utils from '../lib/utils'
const security = require('../lib/insecurity')
const challenges = require('../data/datacache').challenges

module.exports = function retrieveBasket() {
  return (req: Request, res: Response, next: NextFunction) => {
    const id = req.params.id;
    const user = security.authenticatedUsers.from(req);

    // Kiểm tra xem người dùng có đang cố gắng truy cập giỏ hàng không thuộc về họ không
    if (!user || user.bid !== Number(id)) {
      return res.status(403).send({'error': 'Không có quyền truy cập giỏ hàng này.'});
    }

    BasketModel.findOne({ where: { id }, include: [{ model: ProductModel, paranoid: false, as: 'Products' }] })
      .then((basket: BasketModel | null) => {
        if (((basket?.Products) != null) && basket.Products.length > 0) {
          for (let i = 0; i < basket.Products.length; i++) {
            basket.Products[i].name = req.__(basket.Products[i].name);
          }
        }
        res.json(utils.queryResultToJson(basket));
      }).catch((error: Error) => {
        next(error);
      });
  }
}

