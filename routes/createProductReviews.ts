/*
 * Copyright (c) 2014-2023 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response } from 'express'
import challengeUtils = require('../lib/challengeUtils')

import * as utils from '../lib/utils'

const reviews = require('../data/mongodb').reviews
const challenges = require('../data/datacache').challenges
const security = require('../lib/insecurity')

module.exports = function productReviews () {
  return (req: Request, res: Response) => {
    const user = security.authenticatedUsers.from(req)
    if (!user) {
      return res.status(401).json({ status: 'error', message: 'Xác thực là bắt buộc' })
    }

    // Kiểm tra nội dung review
    const reviewContent = req.body.message
    if (!reviewContent || reviewContent.length === 0) {
      return res.status(400).json({ status: 'error', message: 'Nội dung review không được để trống' })
    }

    challengeUtils.solveIf(challenges.forgedReviewChallenge, () => { return user && user.data.email !== req.body.author })
    reviews.insert({
      product: req.params.id,
      message: req.body.message,
      author: user.data.email, // Sử dụng email của người dùng đã xác thực
      likesCount: 0,
      likedBy: []
    }).then(() => {
      res.status(201).json({ status: 'success' })
    }, (err: unknown) => {
      res.status(500).json(utils.getErrorMessage(err))
    })
  }
}

// Trong đoạn code trên, đã thêm:

// Kiểm tra xác thực người dùng.
// Kiểm tra nội dung review không được để trống.
// Sử dụng email của người dùng đã xác thực làm tác giả của review.