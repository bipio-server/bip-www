<?php

class PlansController extends Zend_Controller_Action {

  protected $_session = NULL;

  private $_dao = NULL;

  private $_plans = NULL;

  public function init() {

    $this->_dao = new Bip_DAO_Auth();

    $this->_session = Zend_Registry::get('default');

    $this->view->authed = ($this->_session->authed == 1);
    $this->view->authUser = $this->_session->authUser;
    $this->view->page = 'pricing';
    $this->view->domainPfx = $this->view->authed ? $this->_session->authUser['username'] : '{username}';

    $this->view->accountLevel = $this->_session->authUser['account_level'];

        // masquerade as pro
    if ('admin' === $this->view->accountLevel) {
      $this->view->accountLevel = 'pro';
    }

    $options = Zend_Registry::get('config')->toArray();

    $fc = Zend_Controller_Front::getInstance();;
    $this->_stripe = $fc->getParam('bootstrap')->getResource('stripe');

    $this->_stripe->setDao($this->_dao);

    $this->_plans = $this->_stripe->getPlans();

    $this->view->publicKey = $this->_stripe->getPublicKey();

    if ($this->view->authed) {
      $this->view->emailAddress = $this->_session->authUser['settings']['email_account'];
    } else {
      $this->view->emailAddress = '';
    }

  }

  public function testUpgrade($level) {
    $acctLevel = $this->view->accountLevel;

    if (!$this->view->authed) {
      return true;
    } else {
      switch ($level) {
        case 'basic' :
        return $acctLevel == 'user';
        break;
        case 'standard' :
        return $acctLevel == 'user' || $acctLevel == 'basic';
        break;
        case 'pro' :
        return $acctLevel == 'user' || $acctLevel == 'basic' || $acctLevel == 'standard';
        break;
        default :
        return true;
      }
    }
  }

  public function indexAction() {
    $req = $this->getRequest();
    $this->view->reason = $req->getParam('reason');
    $this->view->msg = $req->getParam('msg');

    if ($this->view->authed) {
      $this->view->buttonAction = 'Upgrade';
    } else {
      $this->view->buttonAction = 'Sign Up';
    }

    $this->view->controller = $this;

    $this->view->podPartialPathPremium = 'docs/partials/pods_premium.phtml';
    $this->view->podPartialPathCommunity = 'docs/partials/pods_community.phtml';

    $this->view->plans = $this->_plans;


    // if promo, then set promo layout
    foreach ($this->_plans as $id => $plan) {
      if ($plan['promo']) {
        $this->_helper->viewRenderer->setRender('index-promo');
        break;
      }
    }


  }

  public function planselectAction() {
    $req = $this->getRequest();
    $this->view->reason = $req->getParam('reason');
    $this->view->msg = $req->getParam('msg');

    if ($this->view->authed) {
      $this->view->buttonAction = 'Upgrade';
    } else {
      $this->view->buttonAction = 'Sign Up';
    }

    $planId = $this->_getParam('planId');

    if (isset($this->_plans[$planId])) {

      $this->view->planId = $planId;
      $this->view->plan = $this->_plans[$planId];

      $this->view->plan['_period'] =
        isset($this->_plans[$planId]['recur']) ? $this->_plans[$planId]['recur'] : 'month';

      $this->view->controller = $this;

      $this->view->podPartialPathPremium = 'docs/partials/pods_premium.phtml';
      $this->view->podPartialPathCommunity = 'docs/partials/pods_community.phtml';

      $this->view->plans = $this->_plans;

      $this->view->planTitle = ucwords(
          str_replace('_', ' ', $planId)
      );

    } else {
      $this->_redirect('/plans?error=Uknown Plan ' . $planId);
    }

//exit;


  }

  // action stub for testing
/*
  public function testAction() {

    $this->_helper->layout()->disableLayout();
    $this->_helper->viewRenderer->setNoRender(true);

$plan = 'basic';
$email = 'michael@wot.io';
$amount = 1000;
$until = '2016-10-27';

    $stripePlan = $this->_stripe->getPlans($plan);

    $wf = new Bip_Service_Workflow();
    $wf->planStart(
      $email,
      $stripePlan['title'],
      '$' . $stripePlan['charge'] / 100,
      $until
    );

  }
*/
  // GET request
  public function upgradeAction() {

    //$this->_response->setHeader('Content-type', 'application/json');

    $this->_helper->layout()->disableLayout();
    $this->_helper->viewRenderer->setNoRender(true);

    $response = array();
    $request = $this->getRequest();

    $message = '';
    $error = false;

    if ($request->isPost()) {
     $req = $this->getRequest();
     $plan = strtolower($req->getParam('plan'));
     $token = $req->getParam('stripeToken');

     $email = $this->_session->authUser['settings']['email_account'];

     if ($email && $plan && $this->_stripe->isPlan($plan) && $token) {

      try {

        // look for existing customer id
        $account = $this->_dao->getAccountById($this->_session->authUser['id']);

        if (isset($account['stripe_customer_id']) && !empty($account['stripe_customer_id']) ) {
          // update plan
          $customer = $this->_stripe->upgradeCustomer(
            $account['stripe_customer_id'],
            $account['account_level'],
            $plan
          );
        }

        if (!$customer) {
          $customer = $this->_stripe->createCustomer($email, $plan, $token);
        }

        if ($this->_stripe->setCustomerPlan(
            $this->_session->authUser['id'],
            $plan,
            $customer->id
          )) {

          $authUser = $this->_session->authUser;
          $authUser['settings']['account_level'] = $plan;
          $authUser['account_level'] = $plan;

          $this->_session->authUser = $authUser;

          // send upgrade notice
          $stripePlan = $this->_stripe->getPlans($plan);

          $wf = new Bip_Service_Workflow();
          $wf->planStart(
            $email,
            $stripePlan['title'],
            '$' . $stripePlan['charge'] / 100,
            date("Y-m-d", strtotime("+1 month"))
          );

        } else {
          $error = true;
          $message = 'An error occurred completing transaction';
        }

      } catch (Exception $e) {
        $error = true;
        $message = 'An error occurred completing transaction';
      }

    } else if (!$token) {
        $error = true;
        $message = 'Unknown Token Or Token Has Expired';

     } else if (!$plan || !$this->_stripe->isPlan($plan)) {
        $error = true;
        $message = 'Unknown Plan';
     } else {
        $error = true;
        $message = 'Unknown Error';
     }
   } else {
    $this->_redirect('/plans');
    exit;
   }

   if ($error) {
    $this->_redirect('/plans?error=' . $message);
   } else {
    // thanks, you've been successfully upgraded!
    $this->_redirect('/dash#upgrade');
   }

   exit;
  }

  public function invoiceAction() {
    $this->_helper->layout()->disableLayout();
    $this->_helper->viewRenderer->setNoRender(true);

    $path = APPLICATION_PATH . '/configs/invoice_htpasswd';
    $resolver = new Zend_Auth_Adapter_Http_Resolver_File($path);

    $config = array(
      'accept_schemes' => 'basic',
      'realm'          => 'stripe',
      'digest_domains' => '/plans/invoice',
      'nonce_timeout'  => 3600,
    );

    $adapter = new Zend_Auth_Adapter_Http($config);

    $adapter->setBasicResolver($resolver);

    $adapter->setRequest( $this->getRequest() );
    $adapter->setResponse( $this->getResponse() );

    $result = $adapter->authenticate();
    if ($result->isValid()) {

      $body = $this->getRequest()->getRawBody();
      $invoice = json_decode($body);

      if ($invoice->type == 'invoice.payment_succeeded') {
        if (!$this->_stripe->updateInvoice($invoice)) {
          //$this->getResponse()->setRawHeader('HTTP/1.1 404 Not Found');
          //$this->getResponse()->sendResponse();
        } else {
          $wf = new Bip_Service_Workflow();
          $wf->payment('$' . $invoice->data->object->total / 100);
        }
      }

    } else {
      $this->getResponse()->setRawHeader('HTTP/1.1 403 Permission Denied');
      $this->getResponse()->sendResponse();
      exit;
    }
  }

  public function rmuserAction() {
    $this->_helper->layout()->disableLayout();
    $this->_helper->viewRenderer->setNoRender(true);

    // check if user has a stripe customer id
    $account = $this->_dao->getAccountById($this->_session->authUser['id']);

    if (isset($account['stripe_customer_id']) && !empty($account['stripe_customer_id']) ) {
      // cancel @ stripe
      $this->_stripe->cancelSubscription($account['stripe_customer_id'], $account['account_level']);
    }

    // call api to remove user
    $options = Zend_Registry::get('config')->toArray();

    Zend_Rest_Client::getHttpClient()->setAuth(
      $options['api']['admin']['username'],
      $options['api']['admin']['key']
    );

    $bipClient = new Zend_Rest_Client($options['api']['admin']['host']);

    try {
      $rmResponse = $bipClient->restGet('/rpc/permissions/remove_user/' . $this->_session->authUser['id']);

      Zend_Session::destroy();

      $wf = new Bip_Service_Workflow();
      $wf->cancel($account['email_account']);

      $this->_redirect('/');

      // end session
    } catch (Exception $e) {
      throw new Exception($e);
      exit;
    }

  }
}