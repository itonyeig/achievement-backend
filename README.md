# Achievements API

An event-driven NestJS backend for unlocking ecommerce achievements and badges
and initiating a ₦300 Paystack cashback when a badge is earned.

## Technology

- NestJS 11
- TypeScript
- MongoDB with Mongoose
- `@nestjs/event-emitter`
- Paystack Transfers API
- Jest and Supertest
- Swagger/OpenAPI

## Design overview

The application represents a purchase as an already completed ecommerce
transaction. Persisting a purchase starts the achievement, badge, and cashback
flow:

```text
POST /purchases/:productId/:userId
        |
        v
Persist purchase using the stored product price
        |
        v
purchase.completed { userId }
        |
        v
Count the user's purchases and unlock an exact milestone
        |
        v
achievement.unlocked { achievement_name, user }
        |
        v
Count the user's achievements and unlock an eligible badge
        |
        v
badge.unlocked { badge_name, user }
        |
        v
Create a pending ₦300 cashback and initiate a Paystack transfer
        |
        v
Paystack webhook marks the cashback completed or failed
```

### Module responsibilities

- `UserModule` creates users and exposes their achievement and badge progress.
- `ProductModule` owns the product catalogue and startup seed.
- `PurchaseModule` records completed purchases and emits
  `purchase.completed`.
- `AchievementModule` processes achievements and badges and emits their events.
- `PaymentModule` owns Paystack recipients, cashback transfers, and transfer
  webhooks.

Achievement and badge definitions are readonly configuration in code rather
than database catalogue records. User unlocks are persisted by name in
`user_achievements` and `user_badges`. Adding a definition to the ordered
configuration makes it available to processing and progress responses without
adding branching logic.

Unique indexes on user/achievement, user/badge, and user/badge-cashback pairs
make event replays idempotent and prevent duplicate unlocks or payouts.

## Assessment assumptions

The assessment leaves some business rules unspecified. This implementation uses
the following explicit assumptions:

1. The assessment defines `First Purchase` and `5 Purchases`, but its
   `Advanced` example requires eight unlocked achievements. The remaining six
   purchase achievements are assumed to continue in increments of five:

   | Purchase count | Achievement    |
   | -------------: | -------------- |
   |              1 | First Purchase |
   |              5 | 5 Purchases    |
   |             10 | 10 Purchases   |
   |             15 | 15 Purchases   |
   |             20 | 20 Purchases   |
   |             25 | 25 Purchases   |
   |             30 | 30 Purchases   |
   |             35 | 35 Purchases   |

2. All configured achievements belong to one implicit purchase group. Because
   the assessment requires only the next available achievement from each group,
   `next_available_achievements` currently contains at most one name.
3. `Advanced` is the only badge named by the assessment. It is unlocked after
   eight achievements. Before it is unlocked, `current_badge` is `null`; after
   it is unlocked, `next_badge` is `null` because no later badge was specified.
4. `POST /purchases/:productId/:userId` represents a completed purchase. Cart,
   checkout, purchase payment, inventory, authentication, discounts, shipping,
   and quantities are outside this assessment flow.
5. A purchase contains one product. Its total is calculated from the current
   product price stored in MongoDB; the client cannot provide the amount.
6. Ten sample products are inserted at application startup only when the
   products collection is empty.
7. User creation uses Paystack's documented Nigerian test transfer details:
   account number `0000000000` and Zenith Bank code `057`. The user's name is
   used as the recipient account name.
8. Cashback is initiated once, when a badge is newly persisted. It is recorded
   as `pending` before calling Paystack and becomes `completed` or `failed` from
   a signed transfer webhook.
9. Paystack test mode simulates transfers and does not move real money.

## Prerequisites

- Node.js and npm
- MongoDB
- A Paystack test account and secret key
- A public HTTPS tunnel such as ngrok when testing Paystack webhooks locally

## Environment variables

Create a `.env` file in the project root:

```dotenv
NODE_ENV=development
PORT=4000
MONGO_URI=mongodb://localhost:27017/achievements
PAYSTACK_SECRET_KEY=sk_test_your_key
PAYSTACK_BASE_URL=https://api.paystack.co
```

`PORT` defaults to `4000`, and `PAYSTACK_BASE_URL` defaults to Paystack's API
URL. `NODE_ENV`, `MONGO_URI`, and `PAYSTACK_SECRET_KEY` are required.

## Paystack setup

1. Use a Paystack test secret key during local development.
2. Disable transfer OTP in the Paystack dashboard. Automated badge cashback
   transfers cannot complete while manual OTP finalization is required.
3. Expose the application through a public HTTPS URL when running locally.
4. Configure the following webhook URL in the Paystack dashboard:

   ```text
   https://<public-host>/api/v1/payment/webhook
   ```

The webhook validates the `x-paystack-signature` header and handles
`transfer.success`, `transfer.failed`, and `transfer.reversed` events.

## Installation and running locally

```bash
npm install
npm run start:dev
```

The API is available at `http://localhost:4000/api/v1` by default.

Swagger documentation is available outside production at:

```text
http://localhost:4000/docs/v1
```

For a production build:

```bash
npm run build
npm run start:prod
```

## Running with Docker Compose

Set `PAYSTACK_SECRET_KEY` in the root `.env` file, then start the application
and MongoDB together:

```bash
docker compose up --build
```

Docker Compose waits for MongoDB to become healthy before starting the API. The
application is available at `http://localhost:4000` by default, and MongoDB data
is retained in the `mongodb_data` volume.

Stop the containers with:

```bash
docker compose down
```

## API endpoints

| Method | Endpoint                               | Purpose                                   |
| ------ | -------------------------------------- | ----------------------------------------- |
| `GET`  | `/api/v1/health`                       | Health check                              |
| `POST` | `/api/v1/user`                         | Create a user and Paystack test recipient |
| `GET`  | `/api/v1/products`                     | Return available products                 |
| `POST` | `/api/v1/purchases/:productId/:userId` | Record a completed purchase               |
| `GET`  | `/api/v1/users/:user/achievements`     | Return achievement and badge progress     |
| `POST` | `/api/v1/payment/webhook`              | Receive signed Paystack transfer events   |

### Create a user

```http
POST /api/v1/user
Content-Type: application/json

{
  "name": "Jane Doe",
  "email": "jane@example.com"
}
```

### Record a purchase

```http
POST /api/v1/purchases/66c740862c2cb219f9b9ef11/66c740862c2cb219f9b9ef12
```

The first identifier is the product ID and the second is the user ID.

### Get achievement progress

```http
GET /api/v1/users/66c740862c2cb219f9b9ef12/achievements
```

Example response before `Advanced` is unlocked:

```json
{
  "success": true,
  "message": "Request was successful",
  "statusCode": 200,
  "data": {
    "unlocked_achievements": [
      "First Purchase",
      "5 Purchases",
      "10 Purchases",
      "15 Purchases",
      "20 Purchases"
    ],
    "next_available_achievements": ["25 Purchases"],
    "current_badge": null,
    "next_badge": "Advanced",
    "remaining_to_unlock_next_badge": 3
  }
}
```

## Testing

Run the unit tests:

```bash
npm test
```

Run the endpoint and event integration tests:

```bash
npm run test:e2e
```

Generate the unit coverage report:

```bash
npm run test:cov
```

Run the linter and verify the production build:

```bash
npm run lint
npm run build
```

The test suite covers DTO validation, controllers, services, schemas, exact
achievement thresholds, event payloads and ordering, idempotency, Paystack
errors, signature verification, cashback state transitions, and the complete
event listener chain.

## Intentional scope exclusions

This assessment implementation does not include a cart, checkout flow, purchase
payment processing, inventory management, authentication, discounts, shipping,
or product quantities.
