<?php

require_once APPLICATION_PATH . '/vendor/stripe-php-3.2.0/init.php';

class Bip_Resource_Stripe  extends Zend_Application_Resource_ResourceAbstract {

    protected $_options = array(
        'secret' => '',
        'public' => ''
    );

    private $_plans = array();

    private $_dao = null;

    public function setDao($dao) {
      $this->_dao = $dao;
    }

    public function init() {
        $stripe = array(
          "secret_key"      => $this->_options['secret'],
          "publishable_key" => $this->_options['public']
        );

        \Stripe\Stripe::setApiKey($stripe['secret_key']);

        $plans  = json_decode(file_get_contents(APPLICATION_PATH . '/configs/plans.json'), true);

        if (!$plans) {

          // fetch and cache plans
          $options = Zend_Registry::get('config')->toArray();

          Zend_Rest_Client::getHttpClient()->setAuth(
            $options['api']['admin']['username'],
            $options['api']['admin']['key']
          );

          $bipClient = new Zend_Rest_Client($options['api']['admin']['host']);

          try {

            $plansResponse = $bipClient->restGet('/rpc/permissions/plans');
            $plans = json_decode($plansResponse ->getBody(), TRUE);

            file_put_contents(APPLICATION_PATH . '/configs/plans.json', $plansResponse ->getBody());

          } catch (Exception $e) {
            throw new Exception($e);
            exit;
          }
        }

        $this->_plans = $plans;

        return $this;
    }

    public function getPublicKey() {
      return $this->_options['public'];
    }

    public function isPlan($plan) {
      return array_key_exists($plan, $this->_plans);
    }

    public function getPlans($plan = '') {
      if ($plan) {
        return $this->_plans[$plan];
      } else {
        return $this->_plans;
      }
    }

    public function createCustomer($email, $plan, $token) {
      return \Stripe\Customer::create(array(
        'email' => $email,
        'plan' => $plan,
        'source'  => $token
      ));
    }

    public function updateInvoice($invoice) {
      $account = $this->_dao->getAccountByStripeId(
        $invoice->data->object->customer
      );

      if ($account) {
        return $this->setCustomerPlan(
          $account['id'],
          $account['account_level'],
          $account['stripe_customer_id'],
          date("Y-m-d", $invoice->data->object->period_end)
        );
      }

      return null;
    }

    public function upgradeCustomer($customerId, $oldPlan, $newPlan) {
      $subscriptionID = '';
      $customer = \Stripe\Customer::retrieve($customerId);

      if ($customer && $customer->subscriptions) {

        $subscriptions = $customer->subscriptions->all(
          array('limit'=>10)
        );

        foreach ($subscriptions['data'] as $subscription) {
          if ($subscription->plan->object == 'plan'
            && $subscription->plan->id == $oldPlan
            && $subscription->status == 'active') {

            $subscriptionID = $subscription->id;
            break;
          }
        }

        if ($subscriptionID) {
          $subscription = $customer->subscriptions->retrieve($subscriptionID);
          $subscription->plan = $newPlan;
          $subscription->save();
          return $customer;
        } else {
          return null;
        }
      } else {
        return null;
      }
    }

    public function cancelCustomer($customerId) {
      $customer = \Stripe\Customer::retrieve($customerId);
      return $customer->delete();
    }

    public function cancelSubscription($customerId, $plan) {
      $customer = \Stripe\Customer::retrieve($customerId);
      if ($customer && $customer->subscriptions) {
        $subscriptions = $customer->subscriptions->all(
          array('limit'=>10)
        );

        foreach ($subscriptions['data'] as $subscription) {
          if ($subscription->plan->object == 'plan'
            && $subscription->plan->id == $plan
            && $subscription->status == 'active') {

            $subscriptionID = $subscription->id;
            break;
          }
        }

        if ($subscriptionID) {
          $subscription = $customer->subscriptions->retrieve($subscriptionID);
          $subscription->cancel();
          return $customer;
        } else {
          return null;
        }
      }
    }

    public function setCustomerPlan($accountId, $plan, $customerId, $until) {
      return $this->_dao->setNewPlan($accountId, $plan, $customerId, $until);
    }
}
