/*
 * Copyright (c) 2014-2023 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response, type NextFunction } from 'express'
import { BasketItemModel } from '../models/basketitem'
import { QuantityModel } from '../models/quantity'
import challengeUtils = require('../lib/challengeUtils')

import * as utils from '../lib/utils'
const challenges = require('../data/datacache').challenges
const security = require('../lib/insecurity')

interface RequestWithRawBody extends Request {
  rawBody: string
}

module.exports.addBasketItem = function addBasketItem () {
  return (req: RequestWithRawBody, res: Response, next: NextFunction) => {
    const result = utils.parseJsonCustom(req.rawBody);
    const user = security.authenticatedUsers.from(req);

    // Duyệt qua kết quả để tìm và xác thực các giá trị
    let productId, basketId, quantity;
    for (let i = 0; i < result.length; i++) {
      switch(result[i].key) {
        case 'ProductId':
          productId = result[i].value;
          break;
        case 'BasketId':
          basketId = result[i].value;
          break;
        case 'quantity':
          quantity = result[i].value;
          break;
      }
    }

    // Kiểm tra xem người dùng có đang cố gắng thêm sản phẩm vào giỏ hàng của người khác không
    if (user && basketId && basketId !== 'undefined' && Number(user.bid) !== Number(basketId)) {
      return res.status(401).send({'error' : 'Invalid BasketId'});
    }

    // Kiểm tra dữ liệu sản phẩm và giỏ hàng
    if (!productId || !basketId || !quantity) {
      return res.status(400).send({'error' : 'Missing ProductId, BasketId, or quantity'});
    }

    const basketItem = { ProductId: productId, BasketId: basketId, quantity };
    challengeUtils.solveIf(challenges.basketManipulateChallenge, () => { 
      return user && basketItem.BasketId && basketItem.BasketId !== 'undefined' && user.bid !== basketItem.BasketId;
    });

    const basketItemInstance = BasketItemModel.build(basketItem);
    basketItemInstance.save()
      .then((addedBasketItem: BasketItemModel) => {
        res.json({ status: 'success', data: addedBasketItem });
      }).catch((error: Error) => {
        next(error);
      });
  }
}

module.exports.quantityCheckBeforeBasketItemAddition = function quantityCheckBeforeBasketItemAddition () {
  return (req: Request, res: Response, next: NextFunction) => {
    void quantityCheck(req, res, next, req.body.ProductId, req.body.quantity).catch((error: Error) => {
      next(error)
    })
  }
}

module.exports.quantityCheckBeforeBasketItemUpdate = function quantityCheckBeforeBasketItemUpdate () {
  return (req: Request, res: Response, next: NextFunction) => {
    BasketItemModel.findOne({ where: { id: req.params.id } }).then((item: BasketItemModel | null) => {
      const user = security.authenticatedUsers.from(req)
      challengeUtils.solveIf(challenges.basketManipulateChallenge, () => { return user && req.body.BasketId && user.bid != req.body.BasketId }) // eslint-disable-line eqeqeq
      if (req.body.quantity) {
        if (item == null) {
          throw new Error('No such item found!')
        }
        void quantityCheck(req, res, next, item.ProductId, req.body.quantity)
      } else {
        next()
      }
    }).catch((error: Error) => {
      next(error)
    })
  }
}

async function quantityCheck (req: Request, res: Response, next: NextFunction, id: number, quantity: number) {
  const product = await QuantityModel.findOne({ where: { ProductId: id } })
  if (product == null) {
    throw new Error('No such product found!')
  }

  // is product limited per user and order, except if user is deluxe?
  if (!product.limitPerUser || (product.limitPerUser && product.limitPerUser >= quantity) || security.isDeluxe(req)) {
    if (product.quantity >= quantity) { // enough in stock?
      next()
    } else {
      res.status(400).json({ error: res.__('We are out of stock! Sorry for the inconvenience.') })
    }
  } else {
    res.status(400).json({ error: res.__('You can order only up to {{quantity}} items of this product.', { quantity: product.limitPerUser.toString() }) })
  }
}
