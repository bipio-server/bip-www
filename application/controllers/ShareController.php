<?php
class ShareController extends Zend_Controller_Action {

  public function init() {
    $this->getResponse()->setHeader('Access-Control-Allow-Origin', '*');

    $this->_session = Zend_Registry::get('default');

    $this->view->authed = ($this->_session->authed == 1);
    $this->view->authUser = $this->_session->authUser;
  }

  public function indexAction() {
    $schemas = json_decode(file_get_contents(APPLICATION_PATH . '/configs/schemas.json'), true);

    if (DEV_ENVIRONMENT) {
      $this->_helper->_layout->setLayout('share');
    } else {
      $this->_helper->_layout->setLayout('build/share');
    }

    $request = $this->getRequest();
    $fc = Zend_Controller_Front::getInstance();;
    $this->_db = $fc->getParam('bootstrap')->getResource('mongo');

    $shares = $this->_db->selectCollection('bip_shares');
    $users = $this->_db->selectCollection('accounts');

    $share = $shares->findOne(array('id' => $request->getParam('id')));
    $user = $users->findOne(array('username' => $request->getParam('username')));

    if ($user != null && $request->getParam('slug') != null) {
      $share = $shares->findOne(array('slug' => $request->getParam('slug')));
    }

    if ($share != null) {
      $this->view->share = $share;
      $this->view->options = Zend_Registry::get('config')->toArray();
      if ($share['type'] == 'trigger') {
        $others = $shares->find(array('config.channel_id' => $share['config']['channel_id']));
      } else {
        $others = $shares->find(array('type' => $share['type']));
      }
      $this->view->others = $others;
    } else {
      $this->_redirect('/404');
    }

    $this->view->bipType = '';
    $this->view->shareId = $request->getParam('id');

    if ('http' === $share['type']) {
      $this->view->bipType = 'Incoming Web Hooks';
    } else if ('smtp' === $share['type']) {
      $this->view->bipType = 'Incoming Email';
    }

    if ('trigger' == $share['type']) {
      $tokens = explode('.', $share['config']['channel_id']);

//      $this->view->bipType = $schemas[$tokens[0]]['title'] . ': ' .$schemas[$tokens[0]]['actions'][$tokens[1]]['title'];
      $this->view->bipType = $schemas[$tokens[0]]['title'];
    }

    $this->view->page = 'docs';
    $this->view->podPartialPath = 'docs/partials/pods.phtml';
    $this->view->authPrompt = $request->getParam('auth');
  }

  public function installAction() {
    $id = $this->getRequest()->getParam('id');
    if ($this->view->authed) {
      $this->_redirect('/dash#community/' . $id);
      return;
    } else {
      $this->_redirect('/share/' . $id . '?auth=1');
    }
  }
}